const consoleElement = document.getElementById('console');
const outputElement = document.getElementById('output');
const classPath = '/str/tools.jar:/files/';
let initialized = false;
let compilerLoaded = false;
let busy = false;

function send(message) {
  window.parent.postMessage(message, window.location.origin);
}

function encodeInput(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function initialize() {
  if (typeof window.cheerpjInit !== 'function') {
    throw new Error('The Java runtime script did not load.');
  }
  await window.cheerpjInit({ status: 'none', version: 8 });
  window.cheerpjCreateDisplay(-1, -1, outputElement);
  initialized = true;
  send({ type: 'ready' });
}

async function run(message) {
  if (!initialized || busy) return;
  busy = true;
  consoleElement.textContent = '';

  try {
    send({ type: 'phase', id: message.id, phase: 'compiling' });
    window.cheerpOSAddStringFile('/str/Main.java', new TextEncoder().encode(message.sourceCode));
    window.cheerpOSAddStringFile('/str/SkillMeshRunner.java', new TextEncoder().encode(
      'import java.io.ByteArrayInputStream;\n'
      + 'import java.util.Base64;\n'
      + 'public final class SkillMeshRunner {\n'
      + '  public static void main(String[] args) throws Exception {\n'
      + '    System.setIn(new ByteArrayInputStream(Base64.getDecoder().decode(args[1])));\n'
      + '    Class<?> entry = Class.forName(args[0]);\n'
      + '    entry.getMethod("main", String[].class).invoke(null, (Object) new String[0]);\n'
      + '  }\n'
      + '}\n',
    ));

    const compileExit = await window.cheerpjRunMain(
      'com.sun.tools.javac.Main',
      classPath,
      '-classpath',
      '/files/',
      '-source',
      '8',
      '-target',
      '8',
      '-encoding',
      'UTF-8',
      '/str/Main.java',
      '/str/SkillMeshRunner.java',
      '-d',
      '/files/',
    );
    if (compileExit !== 0) {
      send({
        type: 'result',
        id: message.id,
        result: {
          status: 'Compilation Error',
          statusId: 6,
          stdout: '',
          stderr: '',
          compileOutput: consoleElement.innerText || 'Java compilation failed.',
          message: '',
          time: null,
          memory: null,
        },
      });
      return;
    }

    consoleElement.textContent = '';
    send({ type: 'phase', id: message.id, phase: 'running' });
    const startedAt = performance.now();
    const exitCode = await window.cheerpjRunMain(
      'SkillMeshRunner',
      classPath,
      'Main',
      encodeInput(message.stdin),
    );
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    const stdout = consoleElement.innerText || '';
    send({
      type: 'result',
      id: message.id,
      result: {
        status: exitCode === 0 ? 'Accepted' : 'Runtime Error',
        statusId: exitCode === 0 ? 3 : 11,
        stdout: exitCode === 0 ? stdout : '',
        stderr: exitCode === 0 ? '' : stdout,
        compileOutput: '',
        message: '',
        time: elapsedSeconds,
        memory: null,
      },
    });
  } catch (error) {
    send({ type: 'startup-error', message: error.message || 'Java execution failed.' });
  } finally {
    busy = false;
  }
}

window.addEventListener('message', event => {
  if (event.source !== window.parent || event.origin !== window.location.origin || !event.data) return;
  if (event.data.type === 'initialize-compiler' && initialized) {
    try {
      window.cheerpOSAddStringFile('/str/tools.jar', new Uint8Array(event.data.compiler));
      compilerLoaded = true;
      send({ type: 'ready-for-run' });
    } catch (error) {
      send({ type: 'startup-error', message: error.message || 'Could not load the Java compiler.' });
    }
    return;
  }
  if (event.data.type === 'run' && compilerLoaded) run(event.data);
});

initialize().catch(error => {
  send({ type: 'startup-error', message: error.message || 'The Java runtime could not start.' });
});
