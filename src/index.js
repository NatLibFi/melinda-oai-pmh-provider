

import startApp from './app';
import * as config from './config';

run();

async function run() {
  let server; // eslint-disable-line functional/no-let

  registerInterruptionHandlers();

  server = await startApp(config); // eslint-disable-line prefer-const

  function registerInterruptionHandlers() {
    process.on('SIGTERM', handleSignal);
    process.on('SIGINT', handleSignal);

    process.on('uncaughtException', ({stack}) => {
      handleTermination({code: 1, message: stack});
    });

    process.on('unhandledRejection', ({stack}) => {
      handleTermination({code: 1, message: stack});
    });

    function handleTermination({code = 0, message}) {
      if (server) {
        server.close();

        if (message) {
          console.error(message); // eslint-disable-line no-console
          return process.exit(code); // eslint-disable-line no-process-exit
        }
      }

      if (message) {
        console.error(message); // eslint-disable-line no-console
        return process.exit(code); // eslint-disable-line no-process-exit
      }

      process.exit(code); // eslint-disable-line no-process-exit
    }

    function handleSignal(signal) {
      handleTermination({code: 1, message: `Received ${signal}`});
    }
  }
}
