import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';
import { PassThrough } from 'stream';

export interface SandboxResult {
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const PYTHON_IMAGE = 'python:3.11-slim';

@Injectable()
export class SandboxService {
  // Connects to the local Docker daemon over its default socket/named
  // pipe — the SAME daemon the `docker` CLI itself talks to.
  private readonly docker = new Docker();

  // Memoised so the (slow, network-bound) pull happens at most once for
  // the lifetime of the process, not on every submission. The first
  // submission after a cold start pays for it; the rest reuse this
  // resolved promise instantly.
  private imageReady: Promise<void> | null = null;

  private ensureImage(): Promise<void> {
    if (this.imageReady) return this.imageReady;
    this.imageReady = (async () => {
      const images = await this.docker.listImages({
        filters: { reference: [PYTHON_IMAGE] },
      });
      if (images.length > 0) return; // Already pulled — nothing to do.
      const stream = await this.docker.pull(PYTHON_IMAGE);
      // pull() returns a progress stream; followProgress is dockerode's
      // helper that resolves the callback only once the pull is fully
      // done. Without awaiting this, createContainer below would race a
      // half-downloaded image.
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err) =>
          err ? reject(err) : resolve(),
        );
      });
    })().catch((err) => {
      // Don't cache a rejected promise — a transient daemon hiccup
      // shouldn't permanently wedge every future submission.
      this.imageReady = null;
      throw err;
    });
    return this.imageReady;
  }

  async runPython(
    code: string,
    stdin: string,
    timeoutMs = 5000,
  ): Promise<SandboxResult> {
    await this.ensureImage();

    const container = await this.docker.createContainer({
      Image: PYTHON_IMAGE,
      // `sh -c` with a FIXED script string — the user's code and input
      // are never concatenated into this command. They ride in as
      // environment variables (Env below), set by the Docker API, not by
      // any shell on our side. Inside the container, `"$SANDBOX_CODE"`
      // expands to exactly one argument because of the double quotes;
      // its contents are handed to `python3 -c` verbatim and are never
      // re-tokenised or evaluated as shell — so this is still safe from
      // command injection, the same guarantee the old array-Cmd form
      // gave, just without the interactive-stdin attach that proved
      // unreliable through the Docker API.
      //
      // `printf %s "$SANDBOX_STDIN"` feeds the test-case input to the
      // program's real stdin with no added trailing newline, so
      // `sys.stdin.read()` in a submission sees precisely what the test
      // case specifies.
      Cmd: [
        'sh',
        '-c',
        'printf %s "$SANDBOX_STDIN" | python3 -c "$SANDBOX_CODE"',
      ],
      Env: [`SANDBOX_CODE=${code}`, `SANDBOX_STDIN=${stdin}`],
      NetworkDisabled: true,
      User: 'nobody',
      HostConfig: {
        Memory: 128 * 1024 * 1024,
        MemorySwap: 128 * 1024 * 1024,
        NanoCpus: 0.5 * 1e9,
        PidsLimit: 64,
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': 'size=16m' },
        AutoRemove: true,
      },
      // No stdin attach — input arrives via SANDBOX_STDIN above. We only
      // attach to READ the combined output stream back out.
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const attachStream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    let stdout = '';
    let stderr = '';
    stdoutStream.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    stderrStream.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    // demuxStream: with Tty:false, Docker multiplexes stdout+stderr onto
    // ONE stream, each chunk prefixed with an 8-byte header saying which
    // stream it belongs to. This splits them back into two separate,
    // readable streams — without it we'd get raw binary header bytes
    // mixed into our captured text.
    this.docker.modem.demuxStream(attachStream, stdoutStream, stderrStream);

    await container.start();

    let timedOut = false;
    const waitPromise = container.wait();
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    });

    // Race, not just await — a hung/looping submission won't ever
    // resolve container.wait() on its own; OUR timeout is what
    // guarantees this function eventually returns regardless of what
    // the submitted code does.
    await Promise.race([waitPromise, timeoutPromise]);

    if (timedOut) {
      try {
        await container.kill();
      } catch {
        // The container may have exited on its own between the race
        // resolving and us calling kill() — nothing left to clean up.
      }
    }

    // container.wait() can resolve a beat before the last buffered
    // output chunk has been demuxed into our strings. Give the attach
    // stream one tick to drain so a fast program's final line of stdout
    // isn't silently dropped.
    await new Promise<void>((resolve) => {
      attachStream.on('end', () => resolve());
      setTimeout(resolve, 100);
    });

    return { stdout, stderr, timedOut };
  }
}
