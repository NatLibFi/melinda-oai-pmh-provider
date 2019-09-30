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

/* eslint-enable max-nested-callbacks */

// import chai from 'chai';
// import chaiHttp from 'chai-http';
// Import oracledbMockFactory from './oracledb-mock';
// import startApp, {__RewireAPI__ as RewireAPI} from './app'; // eslint-disable-line import/named
import testSuiteFactory from './test-utils';

// Chai.use(chaiHttp);

describe('app', () => {
	const generateTestSuite = testSuiteFactory({
		rootPath: [__dirname, '..', 'test-fixtures']
	});

	describe('bib', () => {
		describe('Identify', generateTestSuite('bib', 'Identify'));
		describe('ListMetadataFormats', generateTestSuite('bib', 'ListMetadataFormats'));
		describe('ListSets', generateTestSuite('bib', 'ListSets'));
		describe('GetRecord', generateTestSuite('bib', 'GetRecord'));
		describe('ListIdentifiers', generateTestSuite('bib', 'ListIdentifiers'));
		describe('ListRecords', generateTestSuite('bib', 'ListRecords'));
	});

	/* Describe('aut-names', () => {
		describe('Identify', generateTestSuite('aut-names', 'Identify'));
		describe('ListMetadataFormats', generateTestSuite('aut-names', 'ListMetadataFormats'));
		describe('ListSets', generateTestSuite('aut-names', 'ListSets'));
		describe('GetRecord', generateTestSuite('aut-names', 'GetRecord'));
		describe('ListIdentifiers', generateTestSuite('aut-names', 'ListIdentifiers'));
		describe('ListRecords', generateTestSuite('aut-names', 'ListRecords'));
	});

	describe('aut-subjects', () => {
		describe('Identify', generateTestSuite('aut-subjects', 'Identify'));
		describe('ListMetadataFormats', generateTestSuite('aut-subjects', 'ListMetadataFormats'));
		describe('ListSets', generateTestSuite('aut-subjects', 'ListSets'));
		describe('GetRecord', generateTestSuite('aut-subjects', 'GetRecord'));
		describe('ListIdentifiers', generateTestSuite('aut-subjects', 'ListIdentifiers'));
		describe('ListRecords', generateTestSuite('aut-subjects', 'ListRecords'));
	}); */
});
