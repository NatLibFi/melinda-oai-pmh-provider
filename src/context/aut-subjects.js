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

import {readSetsFile, stripPrivateFields as stripPrivateFieldsDefault} from './utils';

export default ({isPrivileged, setsDirectory}) => {
	return {
		repoName: 'Melinda OAI-PMH provider for authority subject records',
		sets: readSetsFile({setsDirectory, context: 'aut-subjects'}),
		isSupportedFormat: f => ['marc21', 'melinda_marc'].includes(f),
		formatRecord: isPrivileged ? r => r : stripPrivateFields
	};

	function stripPrivateFields(record) {
		const newRecord = stripPrivateFieldsDefault(record);
		newRecord.get(/^667$/).forEach(f => newRecord.removeField(f));
		return newRecord;
	}
};
