/**
* Copyright 2019 University Of Helsinki (The National Library Of Finland)
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

import {readSetsFile, formatBib, stripPrivateFields} from './utils';

export default ({isPrivileged, setsFile, alephLibrary, melindaPrefix}) => {
	return {
		repoName: 'Melinda OAI-PMH provider for bibliographic records',
		sets: readSetsFile(setsFile),
		isSupportedFormat: f => ['oai_dc', 'marc21', 'melinda_marc'].includes(f),
		formatRecord: (record, id, metadataPrefix) => {
			const newRecord = formatBib({
				record, id, metadataPrefix,
				oldPrefix: alephLibrary.toUpperCase(),
				newPrefix: melindaPrefix
			});

			return isPrivileged ? newRecord : stripPrivateFields(newRecord);
		}
	};
};
