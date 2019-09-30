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
import IndexingError from '../indexing-error';
import buildQuery from '../build-query';

export default async function ({maxResults, sets, queries, connection}) {
	const {createLogger, isDeletedRecord} = Utils;
	const logger = createLogger();
	const {
		getEarliestTimestamp, getHeadingsIndex,
		getRecords, getSingleRecord
	} = queries;

	const headingsIndexes = await getHeadingsIndexes();
	const earliestTimestamp = await retrieveEarliestTimestamp();

	return {listRecords, listIdentifiers, getRecord, earliestTimestamp};

	async function getHeadingsIndexes() {
		if (sets.length === 0) {
			return;
		}

		const results = await Promise.all(sets.map(mapIndexes));
		return results.reduce((acc, obj) => ({...acc, ...obj}), {});

		async function mapIndexes({spec, headingsIndexes: setIndexes}) {
			const indexes = await Promise.all(setIndexes.map(getIndex));
			return {[spec]: indexes};

			async function getIndex(value) {
				const {query} = getQuery(getHeadingsIndex({value}));
				const {resultSet} = await connection.execute(query, value, {resultSet: true});
				const row = await resultSet.getRow();

				await resultSet.close();
				return `${row.ID}%`;
			}
		}
	}

	async function retrieveEarliestTimestamp() {
		const {query, args} = getQuery(getEarliestTimestamp());

		const {resultSet} = await connection.execute(query, args, {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();
		return moment(row.TIME, 'YYYYMMDDHHmmss');
	}

	async function getRecord({connection, identifier, metadataPrefix}) {
		const {query, args} = getQuery(getSingleRecord({
			identifier: toAlephId(identifier)
		}));

		const {resultSet} = await connection.execute(query, args, {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();

		if (row) {
			return recordRowCallback({
				row,
				formatRecord: generateFormatter(metadataPrefix)
			});
		}
	}

	async function listRecords(params) {
		return queryRecords({
			...params
		});
	}

	async function listIdentifiers(params) {
		return queryRecords({
			...params,
			includeRecords: false
		});
	}

	async function queryRecords({
		connection, from, until, set, metadataPrefix,
		includeRecords = true, cursor = 0
	}) {
		const params = getParams();
		return executeQuery(params);

		function getParams() {
			const setIndexes = headingsIndexes[set];
			const start = from;
			const end = until;
			const rowCallback = row => recordRowCallback({
				row, includeRecords,
				formatRecord: generateFormatter(metadataPrefix)
			});

			if (start && end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => getRecords({cursor, start, end, headingsIndexes: setIndexes})
				};
			}

			if (start) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => getRecords({cursor, start, headingsIndexes: setIndexes})
				};
			}

			if (end) {
				return {
					rowCallback, connection, cursor,
					genQuery: cursor => getRecords({cursor, end, headingsIndexes: setIndexes})
				};
			}

			return {
				rowCallback, connection, cursor,
				genQuery: cursor => getRecords({cursor, headingsIndexes: setIndexes})
			};
		}

		async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			const {query, args} = getQuery(genQuery(cursor));
			const {resultSet} = await connection.execute(query, args || [], {resultSet: true});

			return pump();

			async function pump(records = []) {
				const row = await resultSet.getRow();

				if (row) {
					const result = rowCallback(row);

					if (records.length + 1 === maxResults) {
						return {
							records: records.concat(result),
							cursor: cursor + maxResults
						};
					}

					return pump(records.concat(result));
				}

				await resultSet.close();

				if (records.length === maxResults) {
					return {records, cursor: cursor + maxResults};
				}

				return {records};
			}
		}
	}

	function recordRowCallback({row, formatRecord, includeRecords = true}) {
		if (row.INDEXING === 'true') {
			throw new IndexingError(row.ID);
		}

		const record = parseRecord(row.RECORD);

		const isDeleted = isDeletedRecord(record);

		if (includeRecords && isDeleted === false) {
			return {
				id: fromAlephId(row.ID),
				time: moment(row.TIME, DB_TIME_FORMAT),
				record: formatRecord(record)
			};
		}

		return {id: fromAlephId(row.ID), time: moment(row.TIME, DB_TIME_FORMAT), isDeleted};
	}

	function generateFormatter(metadataPrefix) {
		return metadataPrefix === 'marc' ?
			formatToStandard :
			r => r;

		function formatToStandard(record) {
			// Get all fields with non-numeric tags
			record.get(/[^0-9]+/).forEach(f => record.removeField(f));
			return record;
		}
	}

	function getQuery({query: queryObj, args}) {
		const query = buildQuery(queryObj);
		debugQuery(query, args);
		return {query, args};

		function debugQuery(query, args) {
			logger.log('debug', `Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
		}
	}
}

