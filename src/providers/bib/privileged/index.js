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

import moment from 'moment';
import {Utils} from '@natlibfi/melinda-commons';
import {ERRORS, DB_TIME_FORMAT} from '../../../constants';
import {getResults, parseRecord} from '../../utils';
import {createLowFilter, createSidFilter, create960Filter} from './filter';
import {recordsQuery, recordsTimeframe, recordsStartTime, recordsEndTime} from './query';

const {createLogger} = Utils;

export async function bibPrivileged() {
	const Logger = createLogger();

	return {listRecords};

	async function listRecords({connection, from, until, set, offset = 0}) {
		try {
			const filter = getFilter();
			return doQuery(filter);
		} catch (err) {
			if (err.code) {
				return {error: err.code};
			}

			throw err;
		}

		function doQuery(filter) {
			const parameters = {connection, cb: rowCallback};

			if (from && until) {
				Object.assign(parameters, recordsTimeframe({offset, from, until}));
			} else if (from) {
				Object.assign(parameters, recordsStartTime({offset, from}));
			} else if (until) {
				Object.assign(parameters, recordsEndTime({offset, until}));
			} else {
				Object.assign(parameters, recordsQuery({offset}));
			}

			Logger.log('debug', 'Executing ListRecords query');

			// Handle incomplete sets
			return getResults(parameters);

			function rowCallback(row) {
				const record = parseRecord(row.DATA);

				if (filter(record)) {
					return {data: record, id: row.ID, time: moment(row.TIME, DB_TIME_FORMAT)};
				}
			}
		}

		function getFilter() {
			return set ? getSetFilter() : () => true;

			function getSetFilter() {
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
						throw Object.assign(new Error(), {code: ERRORS.BAD_ARGUMENT});
				}
			}
		}
	}
}
