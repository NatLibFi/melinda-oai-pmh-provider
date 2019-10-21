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
// Import IndexingError from '../indexing-error';
// import buildQuery from '../build-query';

export default async function ({maxResults, sets, queries, connection}) {
	const {createLogger, isDeletedRecord} = Utils;
	const logger = createLogger();
	const {
		getEarliestTimestamp, getHeadingsIndex,
		getRecords, getSingleRecord
	} = queries;

	const indexes = await getIndexes();
	const earliestTimestamp = await retrieveEarliestTimestamp();

	return {listRecords, listIdentifiers, getRecord, earliestTimestamp};

	async function getIndexes() {
		if (sets.length === 0) {
			return {};
		}

		const cache = {};

		return get(sets.slice());

		async function get(sets, results = {}) {
			const set = sets.shift();

			if (set) {
				const {spec, indexes} = set;

				if (indexes.heading) {
					const headingIndexes = await getHeadingIndexes(indexes.heading.slice());

					return get(sets, {...results, [spec]: {
						...indexes,
						heading: headingIndexes
					}});
				}

				return get(sets, {...results, [spec]: indexes});
			}

			return results;

			async function getHeadingIndexes(values, results = []) {
				const value = values.shift();

				if (value) {
					if ([value] in cache) {
						return getHeadingIndexes(values, results.concat(cache[value]));
					}

					const {query, args} = getQuery(getHeadingsIndex({value}));
					const {resultSet} = await connection.execute(query, args, {resultSet: true});
					const row = await resultSet.getRow();

					await resultSet.close();

					cache[value] = `${row.ID}%`; // eslint-disable-line require-atomic-updates
					return getHeadingIndexes(values, results.concat(cache[value]));
				}

				return results;
			}
		}
	}

	async function retrieveEarliestTimestamp() {
		const {query, args} = getQuery(getEarliestTimestamp());

		const {resultSet} = await connection.execute(query, args, {resultSet: true});
		const row = await resultSet.getRow();

		await resultSet.close();
		return moment(row.TIME, DB_TIME_FORMAT);
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
		const results = await queryRecords(params);
		return {...results, previousCursor: params.cursor};
	}

	async function listIdentifiers(params) {
		return queryRecords({
			...params,
			includeRecords: false
		});
	}

	async function queryRecords({
		connection, from, until, set, metadataPrefix,
		includeRecords = true, cursor
	}) {
		const params = getParams();
		return executeQuery(params);

		function getParams() {
			const setIndexes = indexes[set];
			const startTime = from;
			const endTime = until;
			const rowCallback = row => recordRowCallback({
				row, includeRecords,
				formatRecord: generateFormatter(metadataPrefix)
			});

			return {
				rowCallback, connection, cursor,
				genQuery: cursor => getRecords({cursor, startTime, endTime, indexes: setIndexes})
			};
		}

		async function executeQuery({connection, genQuery, rowCallback, cursor}) {
			const resultSet = await doQuery(cursor);
			const {records, newCursor} = await pump();

			await resultSet.close();

			if (records.length < maxResults) {
				return {records};
			}

			return {
				records,
				cursor: newCursor
			};

			async function doQuery(cursor) {
				const {query, args} = getQuery(genQuery(cursor));
				const {resultSet} = await connection.execute(query, args, {resultSet: true});
				return resultSet;
			}

			async function pump(records = []) {
				const row = await resultSet.getRow();

				if (row) {
					const result = rowCallback(row);

					if (records.length + 1 === maxResults) {
						return {
							records: records.concat(result),
							newCursor: toAlephId(result.id)
						};
					}

					return pump(records.concat(result));
				}

				return {
					records,
					newCursor: toAlephId(records.slice(-1).shift().id)
				};
			}
		}
	}

	function recordRowCallback({row, formatRecord, includeRecords = true}) {
		/*		If (row.INDEXING === 'true') {
			throw new IndexingError(row.ID);
		} */

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

	function getQuery({query, args}) {
		debugQuery(query, args);
		return {
			query,
			args: args || {}
		};

		function debugQuery(query, args) {
			logger.log('debug', `Executing query '${query}'${args ? ` with args: ${JSON.stringify(args)}` : ''}`);
		}
	}
}

