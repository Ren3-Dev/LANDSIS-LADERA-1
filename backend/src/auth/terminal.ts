import { stdin, stdout } from 'node:process';

export function hiddenPassword(label: string): Promise<string> {
  stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const cleanup = () => { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\u0003') { cleanup(); reject(new Error('cancelled')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') value = [...value].slice(0, -1).join('');
        else if (char >= ' ' && [...value].length < 129) value += char;
      }
    };
    stdin.on('data', onData);
  });
}

