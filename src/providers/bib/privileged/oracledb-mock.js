export default () => {
	return {
		createPool: async () => {
			return {
				getConnection: async () => {
					return {
						close: async () => {},
						execute: async () => {
							return {
								resultSet: {
									getRow: async () => {
										return {};
									}
								}
							};
						}
					};
				},
				close: async () => {}
			};
		}
	};
};
