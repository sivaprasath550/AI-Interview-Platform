import { Injectable } from '@nestjs/common';
import Docker from 'dockerode';
import { PassThrough } from 'stream';

export interface SandboxResult {
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

@Injectable()
export class SandboxService {
  // Connects to the local Docker daemon over its default socket/named
  // pipe — the SAME daemon the `docker` CLI itself talks to.
  private readonly docker = new Docker();

  async runPython(
    code: string,
    stdin: string,
    timeoutMs = 5000,
  ): Promise<SandboxResult> {
    const container = await this.docker.createContainer({
      Image: 'python:3.11-slim',
      // Cmd is an ARRAY of discrete arguments, not a shell string Docker
      // has to parse — this is what makes passing raw user code here
      // safe from command injection, unlike shelling out to
      // `docker run ... "${userCode}"` with string interpolation.
      Cmd: ['python3', '-c', code],
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
      OpenStdin: true,
      StdinOnce: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const attachStream = await container.attach({
      stream: true,
      stdin: true,
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
    attachStream.write(stdin);
    attachStream.end();

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

    return { stdout, stderr, timedOut };
  }
}
