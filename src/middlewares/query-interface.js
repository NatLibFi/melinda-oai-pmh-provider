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
// Import {DB_TIME_FORMAT, ERRORS} from './constants';
import {DB_TIME_FORMAT} from './constants';
import {parseRecord} from '../record';

export default function ({maxResults, queries, getFilter = getDefaultFilter, formatRecord = defaultFormatRecord}) {
	const {
		recordsAll, recordsTimeframe, recordsStartTime, recordsEndTime,
		identifiersAll, identifiersTimeframe, identifiersStartTime, identifiersEndTime
	} = queries;

	return {listRecords, listIdentifiers};

	async function listRecords(params) {
		return listResources({...params, queries: {
			resourcesTimeframe: recordsTimeframe,
			resourcesStartTime: recordsStartTime,
			resourcesEndTime: recordsEndTime,
			resourcesAll: recordsAll
		}});
	}

	async function listIdentifiers(params) {
		return listResources({...params, queries: {
			resourcesTimeframe: identifiersTimeframe,
			resourcesStartTime: identifiersStartTime,
			resourcesEndTime: identifiersEndTime,
			resourcesAll: identifiersAll
		}});
	}

	async function listResources({connection, from, until, set, cursor = 0, queries}) {
		const {resourcesAll, resourcesTimeframe, resourcesStartTime, resourcesEndTime} = queries;
		const params = getParams();

		return executeQuery(params);

		function getParams() {
			// Throw new ApiError(ERRORS.NO_SET_HIERARCHY);
			const filter = set ? getFilter(set) : defaultFilter;

			if (from && until) {
				return {
					rowCallback, connection, cursor,
					genQuery: (cursor, limit) => resourcesTimeframe({cursor, limit, from, until})
				};
			}

			if (from) {
				return {
					rowCallback, connection, cursor,
					genQuery: (cursor, limit) => resourcesStartTime({cursor, limit, start: from})
				};
			}

			if (until) {
				return {
					rowCallback, connection, cursor,
					genQuery: (cursor, limit) => resourcesEndTime({cursor, limit, until})
				};
			}

			return {
				rowCallback, connection, cursor,
				genQuery: (cursor, limit) => resourcesAll({cursor, limit})
			};

			function rowCallback(row) {
				if (row.DATA) {
					const record = parseRecord(row.DATA);

					if (filter(record)) {
						return {data: formatRecord(record), id: row.ID, time: moment(row.TIME, DB_TIME_FORMAT)};
					}
				} else {
					return {id: row.ID, time: moment(row.TIME, DB_TIME_FORMAT)};
				}
			}
		}

		async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			return execute({cursor});

			async function execute({results = [], cursor, previousCursor = cursor}) {
				const limit = maxResults - results.length;

				if (limit <= 0) {
					return {results, cursor};
				}

				const {query, args} = genQuery(cursor, limit);
				const {resultSet} = await connection.execute(query, args, {resultSet: true});

				previousCursor = cursor;
				await pump(resultSet);

				// Console.log(`cursor:${cursor};previousCursor:${previousCursor};results:${results.length};limit:${limit}`);

				if (cursor === previousCursor) {
					return {results};
				}

				return execute({results, cursor, previousCursor});

				async function pump(resultSet) {
					const row = await resultSet.getRow();

					if (row) {
						cursor++;
						const result = rowCallback(row);

						if (result) {
							results.push(result);
							return pump(resultSet);
						}
					}

					await resultSet.close();
				}
			}
		}
	}
}

function defaultFormatRecord(record) {
	return record;
}

function defaultFilter() {
	return true;
}

function getDefaultFilter() {
	return defaultFilter;
}
