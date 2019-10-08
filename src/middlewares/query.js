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
	// Const DEFAULT_TIMESTAMP = '200001011200000';
	const INDEXING_COLUMN = 'CASE WHEN z07_rec_key IS NULL THEN \'false\' ELSE \'true\' END indexing';

	return {
		getSingleRecord: ({identifier}) => ({
			args: {identifier},
			query: [
				`SELECT z00_doc_number, time, z00_data record FROM ${library}.z00`,
				{
					stmt: `JOIN ${library}.z106 ON z106_rec_key = z00_doc_number AND z106_upd_time_stamp =`,
					sub: [
						`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s1 WHERE z00_doc_number = s1.z106_rec_key)`
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
		getRecords: ({cursor = 0, startTime, endTime, indexes = {}}) => {
			return {
				args: getArgs(),
				query: build()
			};

			function getArgs() {
				const obj = {};

				if (startTime) {
					obj.startTime = startTime.format('YYYYMMDDHHmmsss');
				}

				if (endTime) {
					obj.endTime = endTime.format('YYYYMMDDHHmmsss');
				}

				return obj;
			}

			function build() {
				if (startTime || endTime) {
					return buildTimeLimitedQuery();
				}

				if (indexes.heading) {
					return buildIndexQuery();
				}

				return buildQuery();

				function buildIndexQuery() {
					return [
						`SELECT s1.z02_doc_number id, z106_upd_time_stamp time, z00_data record, ${INDEXING_COLUMN} FROM fin01.z02 s1`
					].concat(
						genIndexingStatements('s1.z02_doc_number'),
						`JOIN ${library}.z00 ON s1.z02_doc_number = z00_doc_number`,
						genIndexCheckStatement('s1.z02_doc_number'),
						{
							stmt: `JOIN ${library}.z106 s2 ON s1.z02_doc_number = s2.z106_rec_key AND s2.z106_upd_time_stamp = `,
							sub: [
								`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s3 WHERE s2.z106_rec_key = s3.z106_rec_key)`
							]
						},
						`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
					);
				}

				function buildQuery() {
					return [
						`SELECT z00_doc_number id, z106_upd_time_stamp time, z00_data record FROM ${library}.z00`,
						{
							stmt: `JOIN ${library}.z106 s1 ON`,
							sub: [
								{
									stmt: 'z00_doc_number = z106_rec_key AND z106_upd_time_stamp =',
									sub: [
										`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s2 WHERE s1.z106_rec_key = s2.z106_rec_key)`
									]
								}
							]
						},
						`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
					];
				}

				function buildTimeLimitedQuery() {
					const start = [
						`SELECT s1.z106_rec_key id, s1.z106_upd_time_stamp time, z00_data record${indexes.heading ? `, ${INDEXING_COLUMN}` : ''} FROM ${library}.z106 s1`,
						'JOIN fin01.z00 ON s1.z106_rec_key = z00_doc_number'
					];

					const end = [
						{
							stmt: 'JOIN fin01.z106 s2 ON s1.z106_rec_key = s2.z106_rec_key AND s2.z106_upd_time_stamp =',
							sub: [
								'(SELECT MAX(z106_upd_time_stamp) FROM fin01.z106 s3 WHERE s2.z106_rec_key = s3.z106_rec_key)'
							]
						},
						{
							stmt: 'WHERE',
							sub: genTimeConditions()
						},
						`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
					];

					if (indexes.heading) {
						return start.concat(
							genIndexCheckStatement('s1.z106_rec_key'),
							genIndexingStatements('s1.z106_rec_key', indexes.heading),
							end
						);
					}

					return start.concat(end);

					function genTimeConditions() {
						const conditions = [];

						if (startTime) {
							conditions.push('s1.z106_upd_time_stamp >= :startTime');
						}

						if (endTime) {
							conditions.push('s1.z106_upd_time_stamp <= :endTime');
						}

						return generateAnd({conditions, toSub: true});
					}
				}

				function genIndexingStatements(idColumn) {
					return indexes.heading.map((value, index) =>
						`JOIN ${library}.z02 h${index} ON ${idColumn} = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`
					);
				}

				function genIndexCheckStatement(idColumn) {
					return `LEFT JOIN ${library}.z07 ON ${idColumn} = z07_rec_key AND z07_sequence NOT LIKE '3018%'`;
				}
			}
		}
	};
};
