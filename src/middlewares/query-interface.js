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
		recordsStartTime, recordsEndTime, singleRecord
	} = queries;

	return {listRecords, listIdentifiers, getRecord, retrieveEarliestTimestamp};

	async function retrieveEarliestTimestamp({connection}) {
		debugQuery(earliestTimestamp);

		const {resultSet} = await connection.execute(earliestTimestamp, [], {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();
		return moment(row.TIME, 'YYYYMMDDHHmmss');
	}

	async function getRecord({connection, identifier}) {
		const {query, args} = singleRecord({identifier: toAlephId(identifier)});

		debugQuery(query, args);

		const {resultSet} = await connection.execute(query, args, {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();

		if (row) {
			return recordRowCallback(row);
		}
	}

	async function listRecords(params) {
		return listResources(params);
	}

	async function listIdentifiers(params) {
		return listResources({
			...params,
			includeRecord: false
		});
	}

	async function listResources({connection, includeRecord = true, from, until, set, cursor = 0}) {
		const params = getParams();

		return executeQuery(params);

		function getParams() {
			const start = from;
			const end = until;
			const filter = set ? getFilter(set) : defaultFilter;
			const rowCallback = r => recordRowCallback(r, filter, includeRecord);

			if (start && end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => recordsTimeframe({cursor, start, end})
				};
			}

			if (start) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => recordsStartTime({cursor, start})
				};
			}

			if (end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => recordsEndTime({cursor, end})
				};
			}

			return {
				rowCallback, connection, cursor,
				genQuery: cursor => recordsAll({cursor})
			};
		}

		async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			return execute({cursor});

			async function execute({records = [], cursor, previousCursor = cursor}) {
				const {query, args} = genQuery(cursor);

				debugQuery(query, args);

				const {resultSet} = await connection.execute(query, args, {resultSet: true});

				previousCursor = cursor;
				await pump(resultSet);

				if (cursor === previousCursor) {
					return {records};
				}

				if (records.length === maxResults) {
					return {records, cursor};
				}

				return execute({records, cursor, previousCursor});

				async function pump(resultSet) {
					const row = await resultSet.getRow();

					if (row) {
						cursor++;
						const result = rowCallback(row);

						if (result) {
							records.push(result);

							if (records.length === maxResults) {
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

	function recordRowCallback(row, filter, includeRecord = true) {
		const record = parseRecord(row.RECORD);

		if (filter === undefined || filter(record)) {
			if (includeRecord) {
				return {
					record: formatRecord(record),
					id: fromAlephId(row.ID),
					time: moment(row.TIME, DB_TIME_FORMAT)
				};
			}

			return {id: fromAlephId(row.ID), time: moment(row.TIME, DB_TIME_FORMAT)};
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
