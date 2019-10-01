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

import queryInterfaceFactory from './query-interface';
import queryFactory from './query';
import requestFactory from './request';

export default async (params, sets) => {
	const {maxResults, library, connection} = params;
	const queries = queryFactory({library, limit: maxResults});
	const queryInterface = await queryInterfaceFactory({
		maxResults,
		queries,
		sets,
		connection
	});

	return requestFactory({...params, ...queryInterface, listSets});

	function listSets() {
		return sets.map(({spec, name, description}) => ({spec, name, description}));
	}
};
