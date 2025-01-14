// Define types
type ResourceInstance = {
	label: string;
	value: string;
	id: string;
};

type Relationship = {
	label: string;
	objectId: string;
	id: string;
	subjectId: string;
	Object: string;
};

type RoleAssignment = {
	user: string;
	role: string;
	resourceInstance: string;
};

// Generate Graph Data
export const generateGraphData = (
	resources: ResourceInstance[],
	relationships: Map<string, Relationship[]>,
	roleAssignments: RoleAssignment[],
) => {
	const nodes: { data: { id: string; label: string }; classes?: string }[] =
		resources.map(resource => ({
			data: { id: resource.id, label: ` ${resource.label}` },
			classes: 'resource-instance-node',
		}));

	const edges: {
		data: { source: string; target: string; label: string };
		classes?: string;
	}[] = [];
	const existingNodeIds = new Set(nodes.map(node => node.data.id));

	relationships.forEach((relations, resourceId) => {
		relations.forEach(relation => {
			if (!existingNodeIds.has(relation.Object)) {
				nodes.push({
					data: { id: relation.Object, label: `${relation.Object}` },
				});
				existingNodeIds.add(relation.Object);
			}

			if (resourceId !== relation.Object) {
				edges.push({
					data: {
						source: resourceId,
						target: relation.Object,
						label: `IS ${relation.label} OF`,
					},
					classes: 'relationship-connection', // Class for orange lines
				});
			}
		});
	});
	relationships.forEach(relations => {
		relations.forEach(relation => {
			if (!existingNodeIds.has(relation.id)) {
				nodes.push({
					data: { id: relation.objectId, label: `${relation.objectId}` },
				});
				existingNodeIds.add(relation.objectId);
			}

			if (!existingNodeIds.has(relation.objectId)) {
				nodes.push({
					data: { id: relation.objectId, label: `${relation.objectId}` },
				});
				existingNodeIds.add(relation.objectId);
			}

			if (relation.subjectId !== relation.objectId) {
				edges.push({
					data: {
						source: relation.subjectId,
						target: relation.objectId,
						label: relation.label,
					},
					classes: 'relationship-connection', // Class for orange lines
				});
			}
		});
	});

	// add role assignments to the graph
	roleAssignments.forEach(assignment => {
		// Add user nodes with a specific class
		if (!existingNodeIds.has(assignment.user)) {
			nodes.push({
				data: { id: assignment.user, label: `${assignment.user}` },
				classes: 'user-node',
			});
			existingNodeIds.add(assignment.user);
		}

		if (!existingNodeIds.has(assignment.resourceInstance)) {
			nodes.push({
				data: { id: assignment.resourceInstance, label: `${assignment.resourceInstance}` },
				classes: 'resource-instance-node',
			});
			existingNodeIds.add(assignment.resourceInstance);
		}
		// Connect user to resource instance

		if (assignment.role !== 'No Role Assigned') {
			edges.push({
				data: {
					source: assignment.user,
					target: assignment.resourceInstance,
					label: `${assignment.role}`,
				},
			});
		}
	});

	// Ensure that for every target ID in the edges array there is a corresponding node
	edges.forEach(edge => {
		if (!existingNodeIds.has(edge.data.target)) {
			nodes.push({
				data: {
					id: edge.data.target,
					label: `Node ${edge.data.target}`,
				},
				classes: 'resource-instance-node',
			});
			existingNodeIds.add(edge.data.target);
		}
	});

	return { nodes, edges };
};
