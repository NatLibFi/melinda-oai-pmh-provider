/**
* Copyright 2019-2020 University Of Helsinki (The National Library Of Finland)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


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
