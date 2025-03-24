import React, { useEffect, useState } from 'react';
import Spinner from 'ink-spinner';
import { Text } from 'ink';
import { useAuth } from './AuthProvider.js';
import { useEnvironmentApi } from '../hooks/useEnvironmentApi.js';
import { useProjectAPI } from '../hooks/useProjectAPI.js';
import { useOrganisationApi } from '../hooks/useOrganisationApi.js';

export default function EnvironmentInfo() {
	const [state, setState] = useState<'loading' | 'notLoggedIn' | 'done'>(
		'loading',
	);
	const [orgName, setOrgName] = useState<string | undefined>(undefined);
	const [envName, setEnvName] = useState<string | undefined>(undefined);
	const [projName, setProjName] = useState<string | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);

	const { authToken, scope } = useAuth();
	const { getEnvironment } = useEnvironmentApi();
	const { getProject } = useProjectAPI();
	const { getOrg } = useOrganisationApi();

	useEffect(() => {
		const getScopeNames = async () => {
			const { data: org, error: orgError } = await getOrg(
				scope.organization_id,
			);
			const { data: proj, error: projError } = await getProject(
				scope.project_id ?? '',
			);
			const { data: env, error: envError } = await getEnvironment(
				scope.project_id ?? '',
				scope.environment_id ?? '',
			);
			if (orgError || projError || envError) {
				setError(
					(orgError ?? '') + ' ' + (projError ?? '') + ' ' + (envError ?? ''),
				);
			}
			setOrgName(org?.name ?? '');
			setEnvName(env?.name ?? '');
			setProjName(proj?.name ?? '');
			setState('done');
		};

		if (authToken === '') {
			setState('notLoggedIn');
		} else {
			getScopeNames();
		}
	}, [
		authToken,
		getEnvironment,
		getOrg,
		getProject,
		scope.environment_id,
		scope.organization_id,
		scope.project_id,
	]);
	return (
		<>
			{state === 'loading' && (
				<Text>
					Loading Environment Info <Spinner type="dots" />
				</Text>
			)}
			{state === 'notLoggedIn' && (
				<Text dimColor={true}>
					You are not logged in. Run this command with login to login via cli.
				</Text>
			)}
			{orgName && projName && envName && (
				<>
					<Text>You are logged in:</Text>
					<Text>OrganizationId: {orgName}</Text>
					<Text>ProjectId: {projName}</Text>
					<Text>EnvironmentId: {envName}</Text>
				</>
			)}
			{error && <Text>{error}</Text>}
		</>
	);
}
