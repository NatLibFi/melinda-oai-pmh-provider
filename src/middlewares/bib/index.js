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
import {createLowFilter, createSidFilter, create960Filter} from '../utils';
import queryFactory from './query';
import requestFactory from '../request';

export default params => {
	const {maxResults, z106Library, z115Library} = params;
	const queries = queryFactory({z106Library, z115Library});
	const queryInterface = queryInterfaceFactory({
		maxResults,
		getFilter,
		queries
	});

	return requestFactory({...queryInterface, ...params});

	function getFilter(set) {
		switch (set) {
			case 'fennica':
				return createLowFilter(/^FENNI$/);
			case 'viola':
				return createLowFilter(/^VIOLA$/);
			case 'arto':
				return create960Filter(/^ARTO$/);
			case 'helmet':
				return createSidFilter(/^helme$/);
			default:
		}
	}
};
