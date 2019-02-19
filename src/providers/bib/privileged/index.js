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

// import {OAI_IDENTIFIER_PREFIX} from '../../../config';
import oracledb from 'oracledb';
import {ERRORS} from '../../../constants';
import ApiError from '../../../error';
import startApp from '../../../app';
import createService from '../../service';

import {createLowFilter, createSidFilter, create960Filter} from './filter';
import queryFactory from './query';

export default async ({
	httpPort, oaiIdentifierPrefixBase, maxResults,
	instanceUrl, z106Library, z115Library,
	oracleUsername, oraclePassword, oracleConnectString
}) => {
	const queries = queryFactory({z106Library, z115Library});
	const identifierPrefix = `${oaiIdentifierPrefixBase}:bib`;
	const Service = createService({
		maxResults,
		getFilter,
		queries
	});

	return startApp({
		...Service,
		oracledb,
		httpPort, identifierPrefix, instanceUrl, z106Library,
		oracleUsername, oraclePassword, oracleConnectString
	});

	function getFilter(set) {
		switch (set) {
			case 'collection:fennica':
				return createLowFilter('FENNI');
			case 'collection:viola':
				return createLowFilter('VIOLA');
			case 'collection:arto':
				return create960Filter('ARTO');
			case 'collection:helmet':
				return createSidFilter('helme');
			default:
				throw new ApiError(ERRORS.NO_SET_HIERARCHY);
		}
	}
};
