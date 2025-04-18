import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { type infer as zType } from 'zod';
import { useAuth } from '../../AuthProvider.js';
import { useCreateProxy } from '../../../hooks/useCreateProxy.js';
import { useParseProxyData } from '../../../hooks/useParseProxyData.js';
import { options as originalOptions } from '../../../commands/api/create/proxy.js';

type ExtendedOptions = zType<typeof originalOptions>;

type Props = {
	options: ExtendedOptions;
};

type Field = 'key' | 'secret' | 'name' | 'done' | 'input';

export default function CreateProxyConfigComponent({ options }: Props) {
	const { scope } = useAuth();

	// Destructure initial option values for stable deps
	const {
		key: initialKey = '',
		secret: initialSecret = '',
		name: initialName = '',
	} = options;

	// Parse structured data (mapping_rules, auth_mechanism, etc.)
	const { payload, parseError } = useParseProxyData(options);

	// Local state for interactive fields
	const [proxyKey, setProxyKey] = useState<string>(initialKey);
	const [proxySecret, setProxySecret] = useState<string>(initialSecret);
	const [proxyName, setProxyName] = useState<string>(initialName);

	const [currentField, setCurrentField] = useState<Field>('key');

	const {
		status,
		errorMessage,
		createProxy,
		formatErrorMessage,
		setStatus,
		setErrorMessage,
	} = useCreateProxy();

	useEffect(() => {
		if (!scope.project_id || !scope.environment_id) {
			setErrorMessage(
				'Error: scope.project_id and scope.environment_id are required.',
			);
			setStatus('error');
		}
	}, [scope.project_id, scope.environment_id, setErrorMessage, setStatus]);

	// Trigger creation with the latest field values
	const triggerCreate = useCallback(() => {
		createProxy({
			secret: proxySecret,
			key: proxyKey,
			name: proxyName,
			auth_mechanism: payload.auth_mechanism || 'Bearer',
			mapping_rules: payload.mapping_rules || [],
		}).catch((err: unknown) => {
			setErrorMessage(err instanceof Error ? err.message : String(err));
			setStatus('error');
		});
	}, [
		createProxy,
		payload.auth_mechanism,
		payload.mapping_rules,
		proxyKey,
		proxySecret,
		proxyName,
		setErrorMessage,
		setStatus,
	]);

	// Handle parse errors
	useEffect(() => {
		if (parseError) {
			setErrorMessage(parseError);
			setStatus('error');
		}
	}, [parseError, setErrorMessage, setStatus]);

	// On mount: auto-trigger for prefilled or enter interactive mode
	const hasMountedRef = useRef(false);
	useEffect(() => {
		if (hasMountedRef.current) return;
		hasMountedRef.current = true;

		if (initialKey && initialSecret && initialName) {
			setCurrentField('done');
			triggerCreate();
		} else {
			setStatus('input');
			if (!initialKey) setCurrentField('key');
			else if (!initialSecret) setCurrentField('secret');
			else if (!initialName) setCurrentField('name');
		}
	}, [initialKey, initialSecret, initialName, setStatus, triggerCreate]);

	// Once interactive flow completes, fire creation
	useEffect(() => {
		if (currentField === 'done') {
			triggerCreate();
		}
	}, [currentField, triggerCreate]);

	// Handlers for collecting user input
	const handleKeySubmit = useCallback((value: string) => {
		if (value.trim() === '') return;
		setProxyKey(value);
		setCurrentField('secret');
	}, []);

	const handleSecretSubmit = useCallback((value: string) => {
		if (value.trim() === '') return;
		setProxySecret(value);
		setCurrentField('name');
	}, []);

	const handleNameSubmit = useCallback(
		(value: string) => {
			if (value.trim() === '') return;
			setProxyName(value);
			setStatus('processing');
			setCurrentField('done');
		},
		[setStatus],
	);

	// Render different states
	if (status === 'input') {
		if (currentField === 'key') {
			return (
				<>
					<Text color="yellow">Proxy Key is required. Please enter it:</Text>
					<TextInput
						value={proxyKey}
						onChange={setProxyKey}
						onSubmit={handleKeySubmit}
					/>
				</>
			);
		}
		if (currentField === 'secret') {
			return (
				<>
					<Text color="yellow">Proxy Secret is required. Please enter it:</Text>
					<TextInput
						value={proxySecret}
						onChange={setProxySecret}
						onSubmit={handleSecretSubmit}
					/>
				</>
			);
		}
		if (currentField === 'name') {
			return (
				<>
					<Text color="yellow">Proxy Name is required. Please enter it:</Text>
					<TextInput
						value={proxyName}
						onChange={setProxyName}
						onSubmit={handleNameSubmit}
					/>
				</>
			);
		}
	}

	if (status === 'processing') {
		return (
			<Text>
				<Spinner type="dots" /> Creating proxy config...
			</Text>
		);
	}
	if (status === 'error' && errorMessage) {
		return <Text color="red">Error: {formatErrorMessage(errorMessage)}</Text>;
	}
	if (status === 'done') {
		return <Text color="green">Proxy Config created successfully!</Text>;
	}
	return null;
}
