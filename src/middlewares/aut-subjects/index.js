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
import {createHasFieldFilter} from '../utils';

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
		return [
			{
				spec: 'topical', name: 'Topical terms',
				filter: createHasFieldFilter(/^150$/)
			},
			{
				spec: 'geographic', name: 'Geographic names',
				filter: createHasFieldFilter(/^151$/)
			},
			{
				spec: 'genre', name: 'Genre/form terms',
				filter: createHasFieldFilter(/^155$/)
			},
			{
				spec: 'mediumperf', name: 'Medium of performance terms',
				filter: createHasFieldFilter(/^162$/)
			}

		];
	}
};
