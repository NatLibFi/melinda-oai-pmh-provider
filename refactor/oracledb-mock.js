import deepEqual from 'deep-eql';

export default () => {
	const options = [];
	const DEFAULT_OPTIONS = {
		queryPattern: /.*/,
		results: []
	};

	const connection = {
		close: async () => {},
		execute: async (query, args) => {
			const rows = getRows();

			return {
				resultSet: {
					getRow: async () => {
						return rows.shift();
					},
					close: async () => {}
				}
			};

			function getRows() {
				const index = options.findIndex(({queryPattern, expectedArgs}) => {
					if (queryPattern.test(query) && (expectedArgs === undefined || deepEqual(args, expectedArgs))) {
						return true;
					}

					return false;
				});

				if (index >= 0) {
					const {results} = options.splice(index, 1).shift();
					return results;
				}

				return [];
			}
		}
	};

	return {
		getConnection: async () => connection,
		createPool: async () => {
			return {
				getConnection: async () => connection,
				close: async () => {}
			};
		},
		_clear: () => {
			// Clear array
			options.splice(0);
			Object.keys(options).forEach(k => delete options[k]);
		},
		_execute: optList => {
			// Clear array
			options.splice(0);

			optList.forEach(opts => {
				options.push({...DEFAULT_OPTIONS, ...opts});
			});
		}
	};
};
