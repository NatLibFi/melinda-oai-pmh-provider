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

import {formatAut, stripPrivateFields as stripPrivateFieldsDefault} from './common';

export default ({isPrivileged, alephLibrary, melindaPrefix}) => ({
  repoName: 'Melinda OAI-PMH provider for authority subject records',
  isSupportedFormat: f => ['marc21', 'melinda_marc'].includes(f),
  formatRecord: (record, id, metadataPrefix, logLabel) => {
    const newRecord = formatAut({
      record, id, metadataPrefix,
      oldPrefix: alephLibrary.toUpperCase(),
      newPrefix: melindaPrefix,
      logLabel
    });

    return isPrivileged ? newRecord : stripPrivateFields(newRecord);

    function stripPrivateFields(record) {
      const newRecord = stripPrivateFieldsDefault(record);
      newRecord.get(/^667$/u).forEach(f => newRecord.removeField(f));
      return newRecord;
    }
  }
});
