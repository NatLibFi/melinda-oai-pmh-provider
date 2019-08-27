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
import {createSubfieldValueFilter, createSidFilter, create960Filter} from '../utils';
import queryFactory from './query';
import requestFactory from '../request';

export default params => {
	const {maxResults, z106Library, z115Library} = params;
	const queries = queryFactory({z106Library, z115Library, limit: maxResults});
	const queryInterface = queryInterfaceFactory({
		maxResults,
		getFilter,
		queries
	});
	
	return requestFactory({...params, ...queryInterface, listSets});
	
	function getFilter(set) {
		switch (set) {
			case 'fennica':
			return createSubfieldValueFilter([{tag: 'LOW', code: 'a', value: 'FIKKA'}, {tag: '042', code: 'a', value: 'finb'}]);
			case 'viola':
			return createSubfieldValueFilter([{tag: 'LOW', code: 'a', value: 'FIKKA'}, {tag: '042', code: 'a', value: 'finbd'}]);				
			case 'arto':
			return create960Filter(/^ARTO$/);
			case 'helmet':
			return createSidFilter(/^helme$/);
			default:
		}
	}
	
	function listSets() {
		return {
			results: [
				{ spec: 'fennica', name: 'Fennica'},
				{ spec: 'viola', name: 'Viola'},
				{ spec: 'arto', name: 'Arto'},
				{ spec: 'helmet', name: 'Helmet'},
			]
		};
	}
};
