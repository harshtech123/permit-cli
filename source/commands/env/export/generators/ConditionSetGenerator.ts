import { Permit } from 'permitio';
import { HCLGenerator, WarningCollector } from '../types.js';
import { createSafeId } from '../utils.js';
import Handlebars, { TemplateDelegate } from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ResourceRead } from 'permitio/build/main/openapi/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ConditionSetData {
	key: string;
	name: string;
	description?: string;
	conditions: string;
	resource?: ResourceRead;
	resourceType: string;
}

type ValidConditionSet = {
	key: string;
	name: string;
	description?: string;
	conditions: string;
	resource?: ResourceRead;
	resourceType: string;
} | null;

export class ConditionSetGenerator implements HCLGenerator {
	name = 'condition sets';
	private template: TemplateDelegate<{ conditionSets: ConditionSetData[] }>;

	constructor(
		private permit: Permit,
		private warningCollector: WarningCollector,
	) {
		this.template = Handlebars.compile(
			readFileSync(join(__dirname, '../templates/condition-set.hcl'), 'utf-8'),
		);
	}

	async generateHCL(): Promise<string> {
		try {
			const conditionSets = await this.permit.api.conditionSets.list();
			if (
				!conditionSets ||
				!Array.isArray(conditionSets) ||
				conditionSets.length === 0
			) {
				return '';
			}

			const validSets = conditionSets
				.map<ValidConditionSet>(set => {
					try {
						const isResourceSet = set.type === 'resourceset';
						const resourceType = isResourceSet ? 'resource_set' : 'user_set';
						const conditions =
							typeof set.conditions === 'string'
								? set.conditions
								: JSON.stringify(set.conditions || '');

						return {
							key: createSafeId(set.key),
							name: set.name,
							description: set.description,
							conditions,
							resource: set.resource,
							resourceType,
						};
					} catch (setError) {
						this.warningCollector.addWarning(
							`Failed to export condition set ${set.key}: ${setError}`,
						);
						return null;
					}
				})
				.filter((set): set is ConditionSetData => set !== null);

			if (validSets.length === 0) return '';

			return (
				'\n# Condition Sets\n' + this.template({ conditionSets: validSets })
			);
		} catch (error) {
			this.warningCollector.addWarning(
				`Failed to export condition sets: ${error}`,
			);
			return '';
		}
	}
}
