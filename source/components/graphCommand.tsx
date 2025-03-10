import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { apiCall } from '../lib/api.js';
import { saveHTMLGraph } from '../components/HtmlGraphSaver.js';
import { generateGraphData } from '../components/generateGraphData.js';
import zod from 'zod';
import { option } from 'pastel';
import { useAuth } from '../components/AuthProvider.js'; // Import useAuth
import { ActiveState } from './EnvironmentSelection.js';

// Define types
type Relationship = {
	label: string;
	id: string;
	subjectId: string;
	objectId: string;
	Object: string;
};

interface APIResourceInstanceRole {
	resource_instance: string;
	resource: string;
	role: string;
}

interface APITenant {
	tenant: string;
	roles: string[];
	status: string;
	resource_instance_roles?: APIResourceInstanceRole[];
}

interface APIUser {
	key: string;
	email: string;
	associated_tenants?: APITenant[];
}

type RoleAssignment = {
	user: string;
	email: string;
	role: string;
	resourceInstance: string;
};

interface APIRelationship {
	subject: string;
	relation: string;
	object: string;
}

export const options = zod.object({
	apiKey: zod
		.string()
		.optional()
		.describe(
			option({
				description: 'The API key for the Permit env, project or Workspace',
			}),
		),
});

type Props = {
	options: zod.infer<typeof options>;
};

export default function Graph({ options }: Props) {
	const {
		authToken: contextAuthToken,
		loading: authLoading,
		error: authError,
	} = useAuth();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [authToken, setAuthToken] = useState<string | null>(null); // Store resolved authToken
	const [state, setState] = useState<'project' | 'environment' | 'graph'>(
		'project',
	);
	const [projects, setProjects] = useState<ActiveState[]>([]);
	const [environments, setEnvironments] = useState<ActiveState[]>([]);
	const [selectedProject, setSelectedProject] = useState<ActiveState | null>(
		null,
	);
	const [selectedEnvironment, setSelectedEnvironment] =
		useState<ActiveState | null>(null);
	const [noData, setNoData] = useState(false);

	// Resolve the authToken on mount
	useEffect(() => {
		const token = contextAuthToken || options.apiKey || null;
		if (!token) {
			setError('No auth token found. Please log in or provide an API key.');
		} else {
			setAuthToken(token);
		}
	}, [contextAuthToken, options.apiKey]);

	// Fetch projects
	useEffect(() => {
		const fetchProjects = async () => {
			if (!authToken) return;

			try {
				setLoading(true);
				const { response: projects } = await apiCall('v2/projects', authToken);
				// Map projectsData to ActiveState[]
				const mappedProjects: ActiveState[] = projects.map(
					(project: { name: string; id: string }) => ({
						label: project.name,
						value: project.id,
					}),
				);
				setProjects(mappedProjects);
				setLoading(false);
			} catch (err) {
				console.error('Error fetching projects:', err);
				setError('Failed to fetch projects.');
				setLoading(false);
			}
		};

		if (state === 'project') {
			fetchProjects();
		}
	}, [state, authToken]);

	// Fetch environments
	useEffect(() => {
		const fetchEnvironments = async () => {
			if (!authToken || !selectedProject) return;

			try {
				setLoading(true);
				const { response: environments } = await apiCall(
					`v2/projects/${selectedProject.value}/envs`,
					authToken,
				);
				const mappedEnvironments: ActiveState[] = environments.map(
					(env: { name: string; id: string }) => ({
						label: env.name,
						value: env.id,
					}),
				);
				setEnvironments(mappedEnvironments);
				setLoading(false);
			} catch (err) {
				console.error('Error fetching environments:', err);
				setError('Failed to fetch environments.');
				setLoading(false);
			}
		};

		if (state === 'environment') {
			fetchEnvironments();
		}
	}, [state, authToken, selectedProject]);

	// Fetch graph data
	useEffect(() => {
		const fetchData = async () => {
			if (!authToken || !selectedProject || !selectedEnvironment) return;

			try {
				setLoading(true);

				const per_Page = 100; // API limit for 100 records per page
				let Page = 1;
				let hasMoreData = true;
				let allResourcesData: {
					label: string;
					value: string;
					id: string;
					id2: string;
					key: string;
					relationships?: APIRelationship[];
				}[] = [];
				let allRoleAssignmentsData: RoleAssignment[] = [];
				const relationsMap = new Map<string, Relationship[]>();

				while (hasMoreData) {
					const resourceResponse = await apiCall(
						`v2/facts/${selectedProject.value}/${selectedEnvironment.value}/resource_instances/detailed?page=${Page}&per_page=${per_Page}`,
						authToken,
					);
					const resourceArray =
						resourceResponse.response.data || resourceResponse.response;

					const resourcesData = resourceArray.map(
						(res: {
							resource: string;
							resource_id: string;
							id: string;
							key: string;
							relationships?: APIRelationship[];
						}) => ({
							label: `${res.resource}#${res.resource_id}`,
							value: res.id,
							id: res.id,
							id2: `${res.resource}:${res.key}`,
							key: res.key,
							relationships: res.relationships || [],
						}),
					);

					allResourcesData = [...allResourcesData, ...resourcesData];

					// Check if there are more pages to fetch
					hasMoreData = resourceArray.length === per_Page;
					Page++;
				}

				// Create a lookup map for id2 to resource labels
				const id2ToLabelMap = new Map<string, string>();
				allResourcesData.forEach((resource: { id2: string; id: string }) => {
					id2ToLabelMap.set(resource.id2, resource.id);
				});

				allResourcesData.forEach(
					(resource: {
						label: string;
						value: string;
						id: string;
						id2: string;
						key: string;
						relationships?: APIRelationship[];
					}) => {
						const relationsData: APIRelationship[] =
							resource.relationships || [];
						relationsMap.set(
							resource.id,
							relationsData.map((relation: APIRelationship): Relationship => {
								// Check if relation.object matches any id2
								const matchedLabel = id2ToLabelMap.get(relation.object);
								const matchedsubjectid = id2ToLabelMap.get(relation.subject);

								// Convert relation.relation to uppercase
								const relationLabel = relation.relation
									? relation.relation.toUpperCase()
									: 'UNKNOWN RELATION';

								return {
									label: relationLabel,
									objectId: matchedLabel || relation.object,
									Object: relation.object,
									subjectId: matchedsubjectid || relation.subject,
									id: resource.id,
								};
							}),
						);
					},
				);

				Page = 1;
				hasMoreData = true;

				while (hasMoreData) {
					const roleResponse = await apiCall(
						`v2/facts/${selectedProject.value}/${selectedEnvironment.value}/users?include_resource_instance_roles=true&page=${Page}&per_page=${per_Page}`,
						authToken,
					);

					const users: APIUser[] = roleResponse.response?.data || [];

					users.forEach((user: APIUser) => {
						const usernames = user.key;
						const email = user.email;

						// Check if the user has associated tenants
						if (user.associated_tenants?.length) {
							user.associated_tenants.forEach((tenant: APITenant) => {
								if (tenant.resource_instance_roles?.length) {
									tenant.resource_instance_roles.forEach(
										(resourceInstanceRole: APIResourceInstanceRole) => {
											const resourceInstanceId =
												id2ToLabelMap.get(
													`${resourceInstanceRole.resource}:${resourceInstanceRole.resource_instance}`,
												) || resourceInstanceRole.resource_instance;

											allRoleAssignmentsData.push({
												user: usernames || 'Unknown User found',
												email: email || '',
												role: resourceInstanceRole.role || 'Unknown Role',
												resourceInstance:
													resourceInstanceId || 'Unknown Resource Instance',
											});
										},
									);
								} else {
									// Push default entry for users with no roles in the tenant
									allRoleAssignmentsData.push({
										user: usernames || 'Unknown User',
										email: email || '',
										role: 'No Role Assigned',
										resourceInstance: 'No Resource Instance',
									});
								}
							});
						} else {
							// Push default entry for users with no associated tenants
							allRoleAssignmentsData.push({
								user: usernames || 'Unknown User',
								email: email || '',
								role: 'No Role Assigned',
								resourceInstance: 'No Resource Instance',
							});
						}
					});

					// Check if there are more pages to fetch
					hasMoreData = roleResponse.response.data.length === per_Page;
					Page++;
				}

				const graphData = generateGraphData(
					allResourcesData,
					relationsMap,
					allRoleAssignmentsData,
				);

				// If no nodes exist, update the flag and skip saving
				if (graphData.nodes.length === 0) {
					setNoData(true);
					setLoading(false);
					return;
				}

				// Ensure classes is always a string
				const updatedGraphData = {
					...graphData,
					edges: graphData.edges.map(edge => ({
						...edge,
						classes: edge.classes || '',
					})),
				};
				saveHTMLGraph(updatedGraphData);
				setLoading(false);
			} catch (err) {
				console.error('Error fetching graph data:', err);
				setError('Failed to fetch data. Check network or auth token.');
				setLoading(false);
			}
		};

		if (state === 'graph') {
			fetchData();
		}
	}, [state, authToken, selectedProject, selectedEnvironment]);

	// Loading and error states
	if (authLoading || loading) {
		return (
			<Text>
				<Spinner type="dots" />{' '}
				{authLoading ? 'Authenticating...' : 'Loading Permit Graph...'}
			</Text>
		);
	}

	if (authError || error) {
		return <Text color="red">{authError || error}</Text>;
	}

	// If no graph data is present, show a specific message
	if (noData) {
		return <Text>Environment does not contain any data</Text>;
	}

	// State rendering
	if (state === 'project' && projects.length > 0) {
		return (
			<>
				<Text>Select a project</Text>
				<SelectInput
					items={projects}
					onSelect={project => {
						setSelectedProject(project as ActiveState);
						setState('environment');
					}}
				/>
			</>
		);
	}

	if (state === 'environment' && environments.length > 0) {
		return (
			<>
				<Text>Select an environment</Text>
				<SelectInput
					items={environments}
					onSelect={environment => {
						setSelectedEnvironment(environment as ActiveState);
						setState('graph');
					}}
				/>
			</>
		);
	}

	if (state === 'graph') {
		return <Text>Graph generated successfully and saved as HTML!</Text>;
	}

	return <Text>Initializing...</Text>;
}
