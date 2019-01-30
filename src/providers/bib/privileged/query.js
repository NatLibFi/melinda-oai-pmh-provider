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

import {ROW_LIMIT} from '../../../constants';
import {Z106_LIBRARY, Z115_LIBRARY} from '../../../config';

if (!Z115_LIBRARY) {
	throw new Error('Z115_LIBRARY is mandatory');
}

export const RECORD = `SELECT z00_doc_number id, z00_data record FROM ${Z106_LIBRARY}.z00_data`;

export const IDENTIFIERS = `SELECT id, MAX(time) time FROM (
    WITH records AS (
        SELECT z00_doc_number id FROM ${Z106_LIBRARY}.z00 WHERE z00_doc_number >= :startId AND z00_doc_number <= :endId
    )
    SELECT records.id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106
        RIGHT JOIN records ON z106_rec_key = records.id
    UNION
    SELECT records.id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115
        RIGHT JOIN records ON z115_tab = records.id
) GROUP BY id ORDER BY id`;

export const identifiersTimeframe = ({offset, start, end}) => {
	const startDate = start.format('YYYYMMDD');
	const endDate = end.format('YYYYMMDD');
	const z106StartTime = start.format('HHmm');
	const z106EndTime = end.format('HHmm');
	const z115StartTime = start.format('HHmm000000');
	const z115EndTime = end.format('HHmm000000');
	return {
		query: `SELECT id, MAX(time) time FROM (
                    SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106 WHERE
                        (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                        (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                        (z106_update_date > :startDate AND z106_update_date < :endDate)
                    UNION
                    SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115 WHERE
                        (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                        (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                        (z115_today_date > :startDate AND z115_today_date < :endDate)
                ) GROUP BY id ORDER BY id ASC OFFSET ${offset} ROWS FETCH NEXT ${ROW_LIMIT} ROWS ONLY`,
		args: {startDate, endDate, z106StartTime, z106EndTime, z115StartTime, z115EndTime}
	};
};

export const identifiersStartTime = ({offset, start}) => {
	const startDate = start.format('YYYYMMDD');
	const z106StartTime = start.format('HHmm');
	const z115StartTime = start.format('HHmm000000');
	return {
		query: `SELECT id, MAX(time) time FROM (
                    SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106 WHERE
                        (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                        z106_update_date > :startDate
                    UNION
                    SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115 WHERE
                        (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                        z115_today_date > :startDate
                ) GROUP BY id ORDER BY id ASC OFFSET ${offset} ROWS FETCH NEXT ${ROW_LIMIT} ROWS ONLY`,
		args: {startDate, z106StartTime, z115StartTime}
	};
};
export const identifiersEndTime = ({offset, end}) => {
	const endDate = end.format('YYYYMMDD');
	const z106EndTime = end.format('HHmm');
	const z115EndTime = end.format('HHmm000000');
	return {
		query: `SELECT id, MAX(time) time FROM (
                    SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106 WHERE
                        (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                        z106_update_date < :endDate
                    UNION
                    SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115 WHERE
                        (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                        z115_today_date < :endDate
                ) GROUP BY id ORDER BY id ASC OFFSET ${offset} ROWS FETCH NEXT ${ROW_LIMIT} ROWS ONLY`,
		args: {endDate, z106EndTime, z115EndTime}
	};
};

export const recordsQuery = ({offset}) => {
	const startId = String(offset).padStart(9, '0');
	const endId = String(offset + ROW_LIMIT).padStart(9, '0');

	return {
		query: `SELECT id, time, z00_data data FROM (
                    SELECT id, max(time) time FROM (
                        WITH records AS (
                            SELECT z00_doc_number id, z00_data data FROM ${Z106_LIBRARY}.z00 WHERE z00_doc_number >= :startId AND z00_doc_number <= :endId
                        )
                        SELECT records.id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106
                            RIGHT JOIN records ON z106_rec_key = records.id
                        UNION
                        SELECT records.id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115
                            RIGHT JOIN records ON z115_tab = records.id
                    ) GROUP BY id ORDER BY id
                ) JOIN ${Z106_LIBRARY}.z00 ON id = z00_doc_number`,
		args: {startId, endId}
	};
};

export const recordsTimeframe = ({offset, start, end}) => {
	const startDate = start.format('YYYYMMDD');
	const endDate = end.format('YYYYMMDD');
	const z106StartTime = start.format('HHmm');
	const z106EndTime = end.format('HHmm');
	const z115StartTime = start.format('HHmm000000');
	const z115EndTime = end.format('HHmm000000');

	return {
		query: `SELECT id, time, z00_data record FROM (
            SELECT id, MAX(time) time FROM (
                SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106 WHERE
                    (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                    (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                    (z106_update_date > :startDate AND z106_update_date < '20190117')
                UNION
                SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115 WHERE
                    (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                    (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                    (z115_today_date > :startDate AND z115_today_date < :endDate)
            ) GROUP BY id ORDER BY id ASC ${offset} 100 ROWS FETCH NEXT ${ROW_LIMIT} ROWS ONLY
        ) JOIN ${Z106_LIBRARY}.z00 ON id = z00_doc_number`,
		args: {startDate, endDate, z106StartTime, z106EndTime, z115StartTime, z115EndTime}
	};
};
export const recordsStartTime = ({offset, start}) => {
	const startDate = start.format('YYYYMMDD');
	const z106StartTime = start.format('HHmm');
	const z115StartTime = start.format('HHmm000000');

	return {
		query: `SELECT id, time, z00_data record FROM (
            SELECT id, MAX(time) time FROM (
                SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106 WHERE
                    (z106_update_date = :startDate AND z106_time >= :z106StartTime) or
                    z106_update_date > :startDate
                UNION
                SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115 WHERE
                    (z115_today_date = :startDate AND z115_today_time >= :z115StartTime) or
                    z115_today_date > :startDate
            ) GROUP BY id ORDER BY id ASC ${offset} 100 ROWS FETCH NEXT ${ROW_LIMIT} ROWS ONLY
        ) JOIN ${Z106_LIBRARY}.z00 ON id = z00_doc_number`,
		args: {startDate, z106StartTime, z115StartTime}
	};
};
export const recordsEndTime = ({offset, end}) => {
	const endDate = end.format('YYYYMMDD');
	const z106EndTime = end.format('HHmm');
	const z115EndTime = end.format('HHmm000000');

	return {
		query: `SELECT id, time, z00_data record FROM (
            SELECT id, MAX(time) time FROM (
                SELECT z106_rec_key id, CONCAT(z106_update_date, CAST(z106_time AS CHAR(6))) time FROM ${Z106_LIBRARY}.z106 WHERE
                    (z106_update_date = :endDate AND z106_time <= :z106EndTime) or
                    z106_update_date < :endDate
                UNION
                SELECT z115_tab id, CONCAT(CAST(z115_today_date AS CHAR(8)), SUBSTR(z115_today_time,0,6)) time FROM ${Z115_LIBRARY}.z115 WHERE
                    (z115_today_date = :endDate AND z115_today_time <= :z115EndTime) or
                    z115_today_date < :endDate)
            ) GROUP BY id ORDER BY id ASC ${offset} 100 ROWS FETCH NEXT ${ROW_LIMIT} ROWS ONLY
        ) JOIN ${Z106_LIBRARY}.z00 ON id = z00_doc_number`,
		args: {endDate, z106EndTime, z115EndTime}
	};
};
