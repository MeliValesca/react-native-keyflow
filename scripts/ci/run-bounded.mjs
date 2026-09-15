import { spawn } from 'node:child_process';

export function runBounded(
  command,
  args,
  { timeoutMs, graceMs = 5000, stdio = 'inherit' },
) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio });
    let timedOut = false;
    let forced;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forced = setTimeout(() => child.kill('SIGKILL'), graceMs);
    }, timeoutMs);
    const finish = (status, error) => {
      clearTimeout(timer);
      clearTimeout(forced);
      resolve({
        status,
        error: timedOut ? new Error(`Runner exceeded ${timeoutMs}ms`) : error,
      });
    };
    child.once('error', (error) => finish(null, error));
    child.once('exit', (status) => finish(status));
  });
}
