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

import {generateAnd} from '../build-query';

export default ({library, limit}) => {
	return {
		getSingleRecord: ({identifier}) => ({
			args: {identifier},
			query: [
				`SELECT z106_rec_key id, z106_upd_time_stamp time, z00_data record FROM ${library}.z00`,
				{
					stmt: `JOIN ${library}.z106 ON z106_rec_key = z00_doc_number AND z106_upd_time_stamp =`,
					sub: [
						`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s1 WHERE z00_doc_number = s1.z106_rec_key FETCH FIRST ROW ONLY)`
					]
				},
				'WHERE z00_doc_number = :identifier'
			]
		}),
		getHeadingsIndex: ({value}) => ({
			query: [
				`SELECT z01_acc_sequence id FROM ${library}.z01 WHERE z01_rec_key like :value`
			],
			args: {value}
		}),
		getEarliestTimestamp: () => ({
			query: [
				`SELECT MIN(z106_upd_time_stamp) FROM ${library}.z106`
			]
		}),
		getRecords: ({cursor, startTime, endTime, indexes = {}}) => {
			return build();

			function build() {
				if (startTime || endTime) {
					return buildTimeRangeQuery();
				}

				if (indexes.heading) {
					return buildIndexQuery();
				}

				return buildQuery();

				function buildQuery() {
					return {
						args: {
							cursor: cursor || '000000000'
						},
						query: [
							{
								stmt: 'WITH records AS (',
								sub: [
									`SELECT z00_doc_number id FROM ${library}.z00`,
									'WHERE z00_doc_number > :cursor',
									`FETCH NEXT ${limit} ROWS ONLY`
								]
							},
							')',
							{
								stmt: 'SELECT id, time, z00_data record FROM (',
								sub: [
									`SELECT DISTINCT id, MAX(COALESCE(z106_upd_time_stamp, '200001010000000', z106_upd_time_stamp)) time FROM ${library}.z106 s1`,
									'RIGHT JOIN records ON id = z106_rec_key',
									'GROUP BY id',
									'ORDER BY id ASC'
								]
							},
							`) JOIN ${library}.z00 ON id = z00_doc_number`
						]
					};
				}

				function buildIndexQuery() {
					const {whereStmt, joinStatements} = getIndexStatements();

					return {
						args: {
							cursor: cursor || '000000000'
						},
						query: [
							{
								stmt: 'WITH records AS (',
								sub: [].concat(
									`SELECT s1.z02_doc_number id, z00_data record, COALESCE(z07_rec_key, 'false', 'true') indexing FROM ${library}.z02 s1`,
									joinStatements,
									`JOIN ${library}.z00 ON s1.z02_doc_number = z00_doc_number`,
									`LEFT JOIN ${library}.z07 ON s1.z02_doc_number = z07_rec_key AND z07_sequence NOT LIKE '3018%'`,
									whereStmt,
									`FETCH NEXT ${limit} ROWS ONLY`
								)
							},
							')',
							{
								stmt: 'SELECT s1.id, time, indexing, record FROM (',
								sub: [].concat(
									`SELECT DISTINCT z106_rec_key id, MAX(COALESCE(z106_upd_time_stamp, '200001010000000', z106_upd_time_stamp)) time FROM ${library}.z106`,
									'RIGHT JOIN records ON id = z106_rec_key',
									'GROUP BY z106_rec_key'
								)
							},
							') s1 JOIN records ON s1.id = records.id'
						]
					};

					function getIndexStatements() {
						const headingIndexes = indexes.heading.slice();

						return {
							whereStmt: `WHERE s1.z02_rec_key LIKE '${headingIndexes.shift()}' AND s1.z02_doc_number > :cursor`,
							joinStatements: headingIndexes.map((value, index) => {
								return `JOIN ${library}.z02 h${index} ON s1.z02_doc_number = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`;
							})
						};
					}
				}

				function buildTimeRangeQuery() {
					return {
						args: getArgs(),
						query: [
							{
								stmt: 'SELECT id, time, z00_data record FROM (',
								sub: [].concat(
									`SELECT DISTINCT z106_rec_key id, MAX(COALESCE(z106_upd_time_stamp, '200001010000000', z106_upd_time_stamp)) time FROM ${library}.z106 s1`,
									`JOIN ${library}.z00 ON z106_rec_key = z00_doc_number`,
									genIndexStatements(),
									genTimeRangeStatement(),
									'GROUP BY z106_rec_key',
									`FETCH NEXT ${limit} ROWS ONLY`
								)
							},
							`) JOIN ${library}.z00 ON id = z00_doc_number`,
							'ORDER BY id ASC'
						]
					};

					function getArgs() {
						const obj = {
							cursor: cursor || '000000000'
						};

						if (startTime) {
							obj.startTime = startTime.format('YYYYMMDDHHmmsss');
						}

						if (endTime) {
							obj.endTime = endTime.format('YYYYMMDDHHmmsss');
						}

						return obj;
					}

					function genTimeRangeStatement() {
						const conditions = [];

						if (startTime) {
							conditions.push('z106_upd_time_stamp >= :startTime');
						}

						if (endTime) {
							conditions.push('z106_upd_time_stamp <= :endTime');
						}

						return `WHERE ${generateAnd(conditions)} AND z106_rec_key > :cursor`;
					}

					function genIndexStatements() {
						return indexes.heading ? indexes.heading.map((value, index) => {
							return `JOIN ${library}.z02 h${index} ON z106_rec_key = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`;
						}) : [];
					}
				}
			}
		}
	};
};
