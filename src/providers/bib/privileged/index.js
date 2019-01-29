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

import {getResults, parseRecord} from '../../utils';
import {createLowFilter, createSidFilter, create960Filter} from './filter';
import {recordsQuery, recordsTimeframe, recordsStartTime, recordsEndTime} from './query';

export async function bibPrivileged() {
	return {listRecords};

	async function listRecords({connection, from, until, set, offset = 0}) {
		const filter = getFilter();

		return doQuery();

		function doQuery() {
			const parameters = {connection, cb: rowCallback};

			if (from && until) {
				Object.assign(parameters, recordsTimeframe({offset, from, until}));
			} else if (from) {
				Object.assign(recordsStartTime({offset, from}));
			} else if (until) {
				Object.assign(recordsEndTime({offset, until}));
			} else {
				Object.assign(recordsQuery({offset}));
			}

			return getResults(parameters);

			function rowCallback(row) {
				const record = parseRecord(row.RECORD);

				if (filter(record)) {
					return {record, id: row.ID};
				}
			}
		}

		function getFilter() {
			switch (set) {
				case 'collection:fennica':
					return createLowFilter('FENNI');
				case 'collection:viola':
					return createLowFilter('VIOLA');
				case 'collection:arto':
					return create960Filter('ARTO');
				case 'collection:helmet':
					return createSidFilter('helme');
				default:
					break;
			}
		}
	}
}
