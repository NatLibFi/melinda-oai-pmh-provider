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

import queryInterfaceFactory from '../query-interface';
import queryFactory from './query';
import requestFactory from '../request';
import {
	createSubfieldValueFilter, createSidFilter,
	create960Filter, createLeaderFilter
} from '../utils';

export default params => {
	const sets = generateSets();
	const {maxResults, library} = params;

	const queries = queryFactory({library, limit: maxResults});
	const queryInterface = queryInterfaceFactory({
		maxResults,
		getFilter,
		queries
	});

	return requestFactory({...params, ...queryInterface, listSets});

	function getFilter(id) {
		const set = sets.find(({spec}) => spec === id);
		return set ? set.filter : undefined;
	}

	function listSets() {
		return sets.map(({spec, name}) => ({spec, name}));
	}

	function generateSets() {
		const fennicaFilter = createSubfieldValueFilter([{tag: 'LOW', code: 'a', value: 'FIKKA'}, {tag: '042', code: 'a', value: 'finb'}]);
		const monographicFilter = createLeaderFilter({start: 7, end: 7, value: 'm'});
		const serialFilter = createLeaderFilter({start: 7, end: 7, value: 's'});

		return [
			{
				spec: 'fennica', name: 'Fennica',
				filter: fennicaFilter
			},
			{
				spec: 'viola', name: 'Viola',
				filter: createSubfieldValueFilter([{tag: 'LOW', code: 'a', value: 'FIKKA'}, {tag: '042', code: 'a', value: 'finbd'}])
			},
			{
				spec: 'arto', name: 'Arto',
				filter: create960Filter(/^ARTO$/)
			},
			{
				spec: 'helmet', name: 'Helmet',
				filter: createSidFilter(/^helme$/)
			},
			{
				spec: 'monographic', name: 'Monographic records',
				filter: monographicFilter
			},
			{
				spec: 'serial', name: 'Serial records',
				filter: serialFilter
			},
			{
				spec: 'monographic:fennica', name: 'Monographic records (Fennica)',
				filter: r => fennicaFilter(r) && monographicFilter(r)
			},
			{
				spec: 'serial:fennica', name: 'Serial records (Fennica)',
				filter: r => fennicaFilter(r) && serialFilter(r)
			}
		];
	}
};
