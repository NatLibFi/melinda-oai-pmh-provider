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

import {DB_TIME_FORMAT} from '../constants';

export default ({library, limit}) => {
	return {
		getSingleRecord: ({identifier}) => ({
			args: {identifier},
			query: `
			SELECT id, time, z00_data record FROM (
				SELECT DISTINCT z106_rec_key id, MAX(z106_upd_time_stamp) time FROM ${library}.z106
				WHERE z106_rec_key = :identifier
				GROUP BY z106_rec_key
			)
			JOIN ${library}.z00 ON id = z00_doc_number`
		}),
		getHeadingsIndex: ({value}) => ({
			args: {value},
			query: `SELECT z01_acc_sequence id FROM ${library}.z01 WHERE z01_rec_key like :value`
		}),
		getEarliestTimestamp: () => ({
			query: `SELECT MIN(z106_upd_time_stamp) FROM ${library}.z106`
		}),
		getRecords: ({cursor = '000000000', startTime, endTime, indexes = {}}) => {
			return {
				args: genArgs(),
				query: startTime || endTime ? genTime() : indexes.heading ? genIndex() : all()
			};

			function genArgs() {
				const args = {cursor};

				return startTime && endTime ?
					{
						...args,
						startTime: startTime.format(DB_TIME_FORMAT),
						endTime: endTime.format(DB_TIME_FORMAT)
					} : startTime ?
						{
							...args,
							startTime: startTime.format(DB_TIME_FORMAT)
						} : {
							...args,
							endTime: endTime.format(DB_TIME_FORMAT)
						};
			}

			function genTime() {
				return indexes.heading ? index() : basic();

				function basic() {
					const range = 's1.z106_upd_time_stamp >= :startTime AND s1.z106_upd_time_stamp <= :endTime';
					const start = 's1.z106_upd_time_stamp >= :startTime';
					const end = 's1.z106_upd_time_stamp <= :endTime';
					const conditions = startTime && endTime ? range : startTime ? start : end;

					return `
					SELECT id, time, z00_data record FROM (
						SELECT DISTINCT z106_rec_key id, MAX(z106_upd_time_stamp) time FROM ${library}.z106 s1
						WHERE s1.z106_rec_key > :cursor AND ${conditions}
						GROUP BY z106_rec_key
						ORDER BY z106_rec_key ASC
						FETCH NEXT ${limit} ROWS ONLY
					) JOIN ${library}.z00 ON id = z00_doc_number`;
				}

				function index() {
					const range = 's1.z106_upd_time_stamp >= :startTime AND s1.z106_upd_time_stamp <= :endTime';
					const start = 's1.z106_upd_time_stamp >= :startTime';
					const end = 's1.z106_upd_time_stamp <= :endTime';
					const conditions = startTime && endTime ? range : startTime ? start : end;
					const indexStatements = indexes.heading.map((value, index) =>
						`JOIN ${library}.z02 h${index} ON id = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`
					).join('\n');

					return `
					WITH ids AS (
						SELECT DISTINCT z106_rec_key id, MAX(z106_upd_time_stamp) time FROM ${library}.z106 s1
						WHERE s1.z106_rec_key > :cursor AND ${conditions}
						GROUP BY z106_rec_key
						ORDER BY z106_rec_key ASC
					)
					SELECT id, time, z00_data record FROM ids
					${indexStatements}
					JOIN fin01.z00 ON id = z00_doc_number
					FETCH NEXT 1000 ROWS ONLY`;
				}
			}

			function genIndex(indexes) {
				const initialIndex = indexes.heading[0];
				const joinStatements = indexes.heading.slice(1).map((value, index) =>
					`JOIN ${library}.z02 h${index} ON id = h${index}.z02_doc_number AND h${index}.z02_rec_key LIKE '${value}'`
				).join('\n');

				return `
				WITH base AS (
					SELECT z02_doc_number id FROM ${library}.z02
					WHERE z02_rec_key LIKE ${initialIndex} AND z02_doc_number > :cursor
					ORDER BY z02_doc_number ASC
				),
				ids AS (
					SELECT id FROM base
					${joinStatements}  
					FETCH NEXT ${limit} ROWS ONLY
				)
				SELECT id, time, z00_data record FROM (
					SELECT DISTINCT id, MAX(z106_upd_time_stamp) time FROM ids
					JOIN ${library}.z106 ON id = z106_rec_key
					GROUP BY id
				)
				JOIN fin01.z00 ON id = z00_doc_number`;
			}

			function all() {
				return `
				WITH ids AS (
					SELECT z00_doc_number id FROM ${library}.z00
					WHERE z00_doc_number > :cursor
					ORDER BY z00_doc_number ASC
					FETCH NEXT ${limit} ROWS ONLY  
				)
				SELECT id, time, z00_data record FROM (
					SELECT DISTINCT id, MAX(z106_upd_time_stamp) time FROM ids
					JOIN ${library}.z106 ON id = z106_rec_key
					GROUP BY id
				)
				JOIN ${library}.z00 ON id = z00_doc_number`;
			}
		}
	};
};
