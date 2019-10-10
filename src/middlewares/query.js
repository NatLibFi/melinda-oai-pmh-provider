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
					return buildTimeRangeQuery();
				}

				if (indexes.heading) {
					return buildIndexQuery();
				}

				return buildQuery();

				function buildQuery() {
					return [
						`SELECT z00_doc_number id, z106_upd_time_stamp time, z00_data record FROM ${library}.z00`,
						{
							stmt: `JOIN ${library}.z106 s1 ON`,
							sub: [
								{
									stmt: 'z00_doc_number = z106_rec_key AND',
									sub: [
										{
											stmt: 'z106_upd_time_stamp =',
											sub: [
												`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s2 WHERE s1.z106_rec_key = s2.z106_rec_key FETCH FIRST ROW ONLY)`
											]
										}
									]
								}
							]
						},
						`OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`
					];
				}

				function buildIndexQuery() {
					const headingIndexes = indexes.heading.slice();

					const selectStmt = 	`SELECT z106_rec_key id, z106_upd_time_stamp time, z00_data record, CASE WHEN z07_rec_key IS NULL THEN 'false' ELSE 'true' END indexing FROM ${library}.z02 s1`;
					const recordJoinStmt = `JOIN ${library}.z00 ON s1.z02_doc_number = z00_doc_number`;
					const indexCheckStmt = `LEFT JOIN ${library}.z07 ON s1.z02_doc_number = z07_rec_key AND z07_sequence NOT LIKE '3018%'`;
					const rangeStmt = `OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`;
					const timestampStmt = {
						stmt: `JOIN ${library}.z106 s2 ON s1.z02_doc_number = s2.z106_rec_key AND`,
						sub: genTimeConditions()
					};

					const whereStmt = `WHERE s1.z02_rec_key LIKE '${headingIndexes.shift()}'`;

					const indexStatements = headingIndexes.map((value, index) => {
						return `JOIN ${library}.z02 h${index} ON s1.z02_doc_number = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`;
					});

					if (indexStatements.length > 0) {
						return [].concat(
							selectStmt,
							indexStatements,
							recordJoinStmt,
							indexCheckStmt,
							timestampStmt,
							whereStmt,
							rangeStmt
						);
					}

					return [
						selectStmt,
						recordJoinStmt,
						indexCheckStmt,
						timestampStmt,
						whereStmt,
						rangeStmt
					];

					function genTimeConditions() {
						const timeStampCondition = {
							stmt: 's2.z106_upd_time_stamp = ',
							sub: [
								`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s3 WHERE s2.z106_rec_key = s3.z106_rec_key FETCH FIRST ROW ONLY)`
							]
						};

						if (startTime || endTime) {
							return [
								`${genTimeRangeConditions('s2')} AND`,
								timeStampCondition
							];
						}

						return [timeStampCondition];
					}
				}

				function buildTimeRangeQuery() {
					const selectStmt = `SELECT z106_rec_key id, z106_upd_time_stamp time, z00_data record FROM ${library}.z106 s1`;
					const recordJoinStmt = `JOIN ${library}.z00 ON s1.z106_rec_key = z00_doc_number`;

					const timeStmt = {
						stmt: `WHERE ${genTimeRangeConditions('s1')} AND`,
						sub: [
							{
								stmt: 's1.z106_upd_time_stamp =',
								sub: [
									`(SELECT MAX(z106_upd_time_stamp) FROM ${library}.z106 s2 WHERE s1.z106_rec_key = s2.z106_rec_key FETCH FIRST ROW ONLY)`
								]
							}
						]
					};

					const rangeStmt = `OFFSET ${cursor} ROWS FETCH NEXT ${limit} ROWS ONLY`;

					if (indexes.heading) {
						const indexStatements = indexes.heading.map((value, index) => {
							return `JOIN ${library}.z02 h${index} ON s1.z106_rec_key = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`;
						});

						return [].concat(
							selectStmt,
							recordJoinStmt,
							indexStatements,
							`LEFT JOIN ${library}.z07 ON s1.z106_rec_key = z07_rec_key AND z07_sequence NOT LIKE '3018%'`,
							timeStmt,
							rangeStmt
						);
					}

					return [
						selectStmt,
						recordJoinStmt,
						timeStmt,
						rangeStmt
					];
				}

				function genTimeRangeConditions(table, toSub) {
					const conditions = [];

					if (startTime) {
						conditions.push(`${table}.z106_upd_time_stamp >= :startTime`);
					}

					if (endTime) {
						conditions.push(`${table}.z106_upd_time_stamp <= :endTime`);
					}

					return generateAnd({conditions, toSub});
				}
			}
		}
	};
};
