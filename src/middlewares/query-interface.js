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
import {DB_TIME_FORMAT} from './constants';
import {parseRecord, toAlephId, fromAlephId} from '../record';

export default function ({maxResults, queries, getFilter = getDefaultFilter, formatRecord = defaultFormatRecord}) {
	const {createLogger} = Utils;
	const logger = createLogger();
	const {
		recordsAll, earliestTimestamp, recordsTimeframe,
		recordsStartTime, recordsEndTime, identifiersAll,
		identifiersTimeframe, identifiersStartTime, identifiersEndTime,
		singleRecord
	} = queries;

	return {listRecords, listIdentifiers, getRecord, retrieveEarliestTimestamp};

	async function retrieveEarliestTimestamp({connection}) {
		debugQuery(earliestTimestamp);

		const {resultSet} = await connection.execute(earliestTimestamp, [], {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();
		return {results: format()};

		function format() {
			return moment(row.TIME, 'YYYYMMDDHHmmss').format();
		}
	}

	async function getRecord({connection, identifier}) {
		const {query, args} = singleRecord({identifier: toAlephId(identifier)});

		debugQuery(query, args);

		const {resultSet} = await connection.execute(query, args, {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();

		if (row) {
			return {results: recordRowCallback(row)};
		}

		return {};
	}

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
			const start = from;
			const end = until;
			const filter = set ? getFilter(set) : defaultFilter;

			if (start && end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => resourcesTimeframe({cursor, start, end})
					// GenQuery: (cursor, limit) => resourcesTimeframe({cursor, limit, start, end})
				};
			}

			if (start) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => resourcesStartTime({cursor, start})
					// GenQuery: (cursor, limit) => resourcesStartTime({cursor, limit, start})
				};
			}

			if (end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => resourcesEndTime({cursor, end})
					// GenQuery: (cursor, limit) => resourcesEndTime({cursor, limit, end})
				};
			}

			return {
				rowCallback, connection, cursor,
				genQuery: cursor => resourcesAll({cursor})
				// GenQuery: (cursor, limit) => resourcesAll({cursor, limit})
			};

			function rowCallback(row) {
				if (row.RECORD) {
					return recordRowCallback(row, filter);
				}

				return {id: fromAlephId(row.ID), time: moment(row.TIME, DB_TIME_FORMAT)};
			}
		}

		async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			return execute({cursor});

			async function execute({results = [], cursor, previousCursor = cursor}) {
				const {query, args} = genQuery(cursor);

				debugQuery(query, args);

				const {resultSet} = await connection.execute(query, args, {resultSet: true});

				previousCursor = cursor;
				await pump(resultSet);

				if (cursor === previousCursor) {
					return {results};
				}

				if (results.length === maxResults) {
					return {results, cursor};
				}

				return execute({results, cursor, previousCursor});

				async function pump(resultSet) {
					const row = await resultSet.getRow();

					if (row) {
						cursor++;
						const result = rowCallback(row);

						if (result) {
							results.push(result);

							if (results.length === maxResults) {
								await resultSet.close();
								return;
							}

							return pump(resultSet);
						}
					}

					await resultSet.close();
				}
			}
		}
	}

	function recordRowCallback(row, filter) {
		const record = parseRecord(row.RECORD);

		if (filter === undefined || filter(record)) {
			// Return {data: formatRecord(record), id: fromAlephId(row.ID), time: moment(row.TIME, DB_TIME_FORMAT)};
			return {record: formatRecord(record), id: fromAlephId(row.ID), time: moment()};
		}
	}

	function debugQuery(query, args) {
		logger.log('debug', `Executing query '${query}' with args: ${JSON.stringify(args)}`);
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
