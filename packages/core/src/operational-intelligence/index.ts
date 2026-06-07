/**
 * Barrel export for the operational-intelligence submodule directory.
 * P7-S13.5: Re-exports all public symbols from all bounded submodules.
 * P7-S13.6a: Adds common OI advisory envelope + health label taxonomy from shared.ts.
 *
 * Dependency order (no circular deps):
 *   shared.ts → (no OI deps)
 *   proposals.ts → shared.ts
 *   evaluation-events.ts → shared.ts, proposals.ts
 *   category-fit.ts → shared.ts
 *   score-dimensions.ts → shared.ts
 *   score-oi.ts → shared.ts
 *   gates.ts → shared.ts
 *   ledger.ts → shared.ts
 *   score-reference.ts → shared.ts
 *   session-summary.ts → shared.ts
 *   specialist.ts → shared.ts
 *   mcp-advisory.ts → shared.ts
 *   federated.ts → shared.ts, evaluation-events.ts (P8-S3: +connector capability, preflight, dry-run; P8-S10: +ledger idempotency; P8-S11: +discovery topology; P8-S12: +publication result, revocation request)
 */

// shared public types (P7-S13.6a: common OI advisory envelope + health label taxonomy)
export {
	type FlowDeskOIAdvisoryHealthLabelV1,
	type FlowDeskOIAdvisoryEnvelopeV1,
	validateFlowDeskOIAdvisoryEnvelopeV1,
} from "./shared.js";

// proposals (no dependency on evaluation-events)
export {
	type FlowDeskWorkflowPlanProposalCandidateV1,
	type FlowDeskWorkflowPlanProposalV1,
	type FlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskWorkflowPlanProposalScoreEventV1,
	createFlowDeskWorkflowPlanProposalV1,
	createFlowDeskWorkflowPlanProposalSetV1,
	createFlowDeskWorkflowPlanProposalScoreEventV1,
	validateFlowDeskWorkflowPlanProposalV1,
	validateFlowDeskWorkflowPlanProposalSetV1,
	validateFlowDeskWorkflowPlanProposalScoreEventV1,
} from "./proposals.js";

// evaluation-events (depends on proposals)
export {
	type FlowDeskEvaluationOutcomeLabelV1,
	type FlowDeskEvaluationScoreDimensionNameV1,
	type FlowDeskEvaluationScoreDimensionV1,
	type FlowDeskEvaluationEventV1,
	type FlowDeskAdvisoryScoreLedgerEntryV1,
	type FlowDeskAdvisoryScoreLedgerAppendIntentV1,
	type FlowDeskAdvisoryScoreLedgerLineResultV1,
	type FlowDeskAdvisoryScoreLedgerDecodeResultV1,
	type FlowDeskAdvisoryScoreLedgerAppendIntentResultV1,
	createFlowDeskEvaluationEventV1,
	createFlowDeskAdvisoryScoreLedgerEntryV1,
	validateFlowDeskEvaluationEventV1,
	validateFlowDeskAdvisoryScoreLedgerEntryV1,
	encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine,
	decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine,
	decodeFlowDeskAdvisoryScoreLedgerJsonl,
	createFlowDeskAdvisoryScoreLedgerAppendIntentV1,
} from "./evaluation-events.js";

// category-fit
export {
	type FlowDeskCategoryFitSnapshotV1,
	createFlowDeskCategoryFitSnapshotV1,
	validateFlowDeskCategoryFitSnapshotV1,
} from "./category-fit.js";

// score-dimensions
export {
	type FlowDeskOptimizerScoreDimensionNameV1,
	type FlowDeskOptimizerScoreDimensionV1,
	type FlowDeskOptimizerProposalScoreV1,
	type FlowDeskNormalizedScoreAggregationV1,
	type FlowDeskNormalizedScoreAggregationResultV1,
	createFlowDeskOptimizerProposalScoreV1,
	createFlowDeskNormalizedScoreAggregationV1,
	validateFlowDeskOptimizerProposalScoreV1,
	validateFlowDeskNormalizedScoreAggregationV1,
} from "./score-dimensions.js";

// score-oi
export {
	type FlowDeskOperationalIntelligenceScoreV1,
	type FlowDeskReferencePackV1,
	createFlowDeskOperationalIntelligenceScoreV1,
	validateFlowDeskOperationalIntelligenceScoreV1,
	validateFlowDeskReferencePackV1,
} from "./score-oi.js";

// gates
export {
	type FlowDeskScoreReuseDecisionLabelV1,
	type FlowDeskScoreReuseThresholdGateV1,
	type FlowDeskScoreReuseThresholdGateResultV1,
	createFlowDeskScoreReuseThresholdGateV1,
	validateFlowDeskScoreReuseThresholdGateV1,
	type FlowDeskFanoutCadenceDecisionLabelV1,
	type FlowDeskFanoutCadenceGateV1,
	type FlowDeskFanoutCadenceGateResultV1,
	createFlowDeskFanoutCadenceGateV1,
	validateFlowDeskFanoutCadenceGateV1,
	type FlowDeskSurplusUsageDecisionLabelV1,
	type FlowDeskSurplusUsageGateV1,
	type FlowDeskSurplusUsageGateResultV1,
	createFlowDeskSurplusUsageGateV1,
	validateFlowDeskSurplusUsageGateV1,
} from "./gates.js";

// admission (R3 OI admission, fanout reservation, advisory variant result)
export {
	type FlowDeskR3ExecutionModeV1,
	type FlowDeskR3AdmissionDecisionV1,
	type FlowDeskR3AdmissionDecisionResultV1,
	createFlowDeskR3AdmissionDecisionV1,
	validateFlowDeskR3AdmissionDecisionV1,
	type FlowDeskR3ReservationStatusV1,
	type FlowDeskR3FanoutReservationV1,
	type FlowDeskR3FanoutReservationResultV1,
	createFlowDeskR3FanoutReservationV1,
	validateFlowDeskR3FanoutReservationV1,
	type FlowDeskAdvisoryVariantOutcomeClassV1,
	type FlowDeskAdvisoryVariantResultV1,
	type FlowDeskAdvisoryVariantResultResultV1,
	createFlowDeskAdvisoryVariantResultV1,
	validateFlowDeskAdvisoryVariantResultV1,
} from "./admission.js";

// ledger
export {
	type FlowDeskLocalLedgerSnapshotV1,
	type FlowDeskLocalLedgerSnapshotResultV1,
	createFlowDeskLocalLedgerSnapshotV1,
	validateFlowDeskLocalLedgerSnapshotV1,
} from "./ledger.js";

// score-reference
export {
	type FlowDeskScoreReferencePackV1,
	type FlowDeskScoreReferencePackResultV1,
	createFlowDeskScoreReferencePackV1,
	validateFlowDeskScoreReferencePackV1,
	type FlowDeskWorkflowSignatureIndexEntryV1,
	type FlowDeskWorkflowSignatureIndexEntryResultV1,
	createFlowDeskWorkflowSignatureIndexEntryV1,
	validateFlowDeskWorkflowSignatureIndexEntryV1,
} from "./score-reference.js";

// session-summary (FlowDeskOIAdvisoryHealthLabelV1 is now exported from shared above)
export {
	type FlowDeskOISessionSummaryV1,
	type FlowDeskOISessionSummaryResultV1,
	createFlowDeskOISessionSummaryV1,
	validateFlowDeskOISessionSummaryV1,
} from "./session-summary.js";

// specialist
export {
	type FlowDeskSpecialistWorkflowEligibilityDecisionV1,
	type FlowDeskSpecialistCategoryV1,
	type FlowDeskSpecialistWorkflowEligibilityV1,
	type FlowDeskSpecialistWorkflowEligibilityResultV1,
	createFlowDeskSpecialistWorkflowEligibilityV1,
	validateFlowDeskSpecialistWorkflowEligibilityV1,
} from "./specialist.js";

// mcp-advisory
export {
	type FlowDeskMCPConnectorKindV1,
	type FlowDeskMCPConnectorStateV1,
	type FlowDeskMCPConnectorAdvisoryV1,
	type FlowDeskMCPConnectorAdvisoryResultV1,
	createFlowDeskMCPConnectorAdvisoryV1,
	validateFlowDeskMCPConnectorAdvisoryV1,
} from "./mcp-advisory.js";

// task-block-scoring
export {
	type FlowDeskTaskBlockCategoryV1,
	type FlowDeskTaskBlockModelTierV1,
	type FlowDeskTaskBlockScoringV1,
	createFlowDeskTaskBlockScoringV1,
	validateFlowDeskTaskBlockScoringV1,
	type FlowDeskDesignSpecQualityV1,
	createFlowDeskDesignSpecQualityV1,
	validateFlowDeskDesignSpecQualityV1,
} from "./task-block-scoring.js";

// federated (Phase 8 scaffold; depends on evaluation-events)
// P8-S3: federated registry connector capability + preflight contracts
// P8-S4: connector gate evaluator (always-false, blocked-by-default)
// P8-S6a: OAuth/consent architecture contracts (advisory-only, no runtime OAuth calls)
// P8-S8: GitHub dry-run publication planner (pure advisory wiring)
// P8-S11: federated discovery topology contracts (config + query plan)
// P8-S12: actual publication result + revocation advisory contracts
export {
	type FlowDeskFederatedScoreRegistryPublicationRequestV1,
	type FlowDeskFederatedScoreRegistryPublicationIntentV1,
	type FlowDeskFederatedScoreRegistryPublicationIntentResultV1,
	createFlowDeskFederatedScoreRegistryPublicationIntentV1,
	validateFlowDeskFederatedScoreRegistryPublicationIntentV1,
	validateFlowDeskFederatedScoreRegistryPublicationRequestV1,
	type FlowDeskFederatedGateEvaluationInputV1,
	type FlowDeskFederatedGateEvaluationResultV1,
	evaluateFlowDeskFederatedRegistryConnectorGateV1,
	validateFlowDeskFederatedGateEvaluationResultV1,
	type FlowDeskFederatedConnectorKindV1,
	type FlowDeskFederatedConnectorCapabilityStateV1,
	type FlowDeskFederatedRegistryConnectorCapabilityV1,
	type FlowDeskFederatedRegistryConnectorCapabilityResultV1,
	createFlowDeskFederatedRegistryConnectorCapabilityV1,
	validateFlowDeskFederatedRegistryConnectorCapabilityV1,
	type FlowDeskFederatedPreflightStateV1,
	type FlowDeskFederatedRegistryPublicationPreflightV1,
	type FlowDeskFederatedRegistryPublicationPreflightResultV1,
	createFlowDeskFederatedRegistryPublicationPreflightV1,
	validateFlowDeskFederatedRegistryPublicationPreflightV1,
	type FlowDeskGitHubDryRunStateV1,
	type FlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskGitHubDryRunPublicationResultResultV1,
	createFlowDeskGitHubDryRunPublicationResultV1,
	validateFlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskFederatedConsentScopeV1,
	type FlowDeskFederatedConsentRecordV1,
	type FlowDeskFederatedConsentRecordResultV1,
	createFlowDeskFederatedConsentRecordV1,
	validateFlowDeskFederatedConsentRecordV1,
	type FlowDeskGitHubOAuthAuthStateV1,
	type FlowDeskGitHubOAuthArchitectureV1,
	type FlowDeskGitHubOAuthArchitectureResultV1,
	createFlowDeskGitHubOAuthArchitectureV1,
	validateFlowDeskGitHubOAuthArchitectureV1,
	// P8-S7: data minimization policy
	type FlowDeskFederatedDataMinimizationPolicyV1,
	type FlowDeskFederatedDataMinimizationPolicyResultV1,
	createFlowDeskFederatedDataMinimizationPolicyV1,
	validateFlowDeskFederatedDataMinimizationPolicyV1,
	// P8-S7: canonical workflow ref
	type FlowDeskFederatedCanonicalWorkflowRefV1,
	type FlowDeskFederatedCanonicalWorkflowRefResultV1,
	createFlowDeskFederatedCanonicalWorkflowRefV1,
	validateFlowDeskFederatedCanonicalWorkflowRefV1,
	// P8-S8: GitHub dry-run publication planner
	type FlowDeskGitHubDryRunPublicationPlanInputV1,
	type FlowDeskGitHubDryRunPublicationPlanResultV1,
	planFlowDeskGitHubDryRunPublicationV1,
	// P8-S10: federated ledger idempotency record (global uniqueness contract)
	type FlowDeskFederatedLedgerIdempotencyRecordV1,
	type FlowDeskFederatedLedgerIdempotencyRecordResultV1,
	createFlowDeskFederatedLedgerIdempotencyRecordV1,
	validateFlowDeskFederatedLedgerIdempotencyRecordV1,
	computeFederatedLedgerEntryId,
	// P8-S11: federated discovery topology contracts
	type FlowDeskFederatedDiscoveryConfigV1,
	type FlowDeskFederatedDiscoveryConfigResultV1,
	createFlowDeskFederatedDiscoveryConfigV1,
	validateFlowDeskFederatedDiscoveryConfigV1,
	type FlowDeskFederatedDiscoveryQueryPlanV1,
	type FlowDeskFederatedDiscoveryQueryPlanResultV1,
	createFlowDeskFederatedDiscoveryQueryPlanV1,
	validateFlowDeskFederatedDiscoveryQueryPlanV1,
	// P8-S12: actual publication result + revocation advisory contracts
	type FlowDeskFederatedPublicationStateV1,
	type FlowDeskFederatedPublicationResultV1,
	type FlowDeskFederatedPublicationResultResultV1,
	createFlowDeskFederatedPublicationResultV1,
	validateFlowDeskFederatedPublicationResultV1,
	type FlowDeskFederatedRevocationReasonV1,
	type FlowDeskFederatedRevocationStateV1,
	type FlowDeskFederatedRevocationRequestV1,
	type FlowDeskFederatedRevocationRequestResultV1,
	createFlowDeskFederatedRevocationRequestV1,
	validateFlowDeskFederatedRevocationRequestV1,
} from "./federated.js";

// scoring-engine (P7-S14: minimal OI scoring engine)
export {
	type FlowDeskScoringEngineInputV1,
	type FlowDeskScoringEngineResultV1,
	scoreWorkflowProposal,
} from "./scoring-engine.js";

// model-capability-profile (P7-S13.7)
export {
	type FlowDeskModelCapabilityProfileCategoryV1,
	type FlowDeskCategoryFitnessMapV1,
	type FlowDeskModelCapabilityProfileV1,
	createFlowDeskModelCapabilityProfileV1,
	validateFlowDeskModelCapabilityProfileV1,
	FLOWDESK_INITIAL_MODEL_PROFILES,
} from "./model-capability-profile.js";

// block-selection-criteria (P7-S13.7)
export {
	type FlowDeskBlockSelectionCriteriaV1,
	createFlowDeskBlockSelectionCriteriaV1,
	validateFlowDeskBlockSelectionCriteriaV1,
} from "./block-selection-criteria.js";

// model-selection-result (P7-S13.7)
export {
	type FlowDeskModelSelectionPurposeV1,
	type FlowDeskModelSelectionReasonV1,
	type FlowDeskIneligibleModelFailedThresholdV1,
	type FlowDeskIneligibleModelEntryV1,
	type FlowDeskModelSelectionResultV1,
	createFlowDeskModelSelectionResultV1,
	validateFlowDeskModelSelectionResultV1,
	selectModelForBlock,
} from "./model-selection-result.js";

// block-decomposition (operational intelligence later gate)
export {
	type FlowDeskSubBlockEstimateV1,
	type FlowDeskBlockDecompositionV1,
	type FlowDeskBlockDecompositionV1Result,
	createFlowDeskBlockDecompositionV1,
	validateFlowDeskBlockDecompositionV1,
} from "./block-decomposition.js";

// block-hierarchy (operational intelligence later gate)
export {
	type FlowDeskHierarchyNodeStatusV1,
	type FlowDeskHierarchyNodeV1,
	type FlowDeskBlockHierarchyStatusV1,
	type FlowDeskBlockHierarchyV1,
	type FlowDeskBlockHierarchyV1Result,
	createFlowDeskBlockHierarchyV1,
	validateFlowDeskBlockHierarchyV1,
} from "./block-hierarchy.js";

// block-score-reconciliation (operational intelligence later gate)
export {
	type FlowDeskBlockScoreReconciliationActionV1,
	type FlowDeskBlockScoreReconciliationV1,
	type FlowDeskBlockScoreReconciliationV1Result,
	createFlowDeskBlockScoreReconciliationV1,
	validateFlowDeskBlockScoreReconciliationV1,
} from "./block-score-reconciliation.js";

// block-decomposition-failure (operational intelligence later gate)
export {
	type FlowDeskBlockDecompositionFailureReasonV1,
	type FlowDeskBlockDecompositionFailureV1,
	type FlowDeskBlockDecompositionFailureV1Result,
	createFlowDeskBlockDecompositionFailureV1,
	validateFlowDeskBlockDecompositionFailureV1,
} from "./block-decomposition-failure.js";

// proposal-generator-config (operational intelligence later gate)
export {
	type FlowDeskProposalReviewTierV1,
	type FlowDeskProposalCostBudgetHintV1,
	type FlowDeskProposalGenerationStrategyV1,
	type FlowDeskProposalGeneratorConfigV1,
	type FlowDeskProposalGeneratorConfigV1Result,
	createFlowDeskProposalGeneratorConfigV1,
	validateFlowDeskProposalGeneratorConfigV1,
} from "./proposal-generator-config.js";

// proposal-generator (R3-S2: planning bridge from config → proposal set)
export {
	type FlowDeskProposalGenerationInputV1,
	type FlowDeskProposalGenerationResultV1,
	planFlowDeskWorkflowPlanProposalSetV1,
} from "./proposal-generator.js";

// r3-reservation-lifecycle-event (R3-S3: reservation lifecycle event)
export {
	type FlowDeskR3ReservationLifecycleEventKindV1,
	type FlowDeskR3ReservationLifecycleEventV1,
	type FlowDeskR3ReservationLifecycleEventResultV1,
	createFlowDeskR3ReservationLifecycleEventV1,
	validateFlowDeskR3ReservationLifecycleEventV1,
} from "./r3-reservation-lifecycle-event.js";

// r3-admission-orchestrator (R3-S3: cadence orchestrator + reservation lifecycle)
export {
	type FlowDeskR3AdmissionOrchestrationInputV1,
	type FlowDeskR3AdmissionOrchestrationResultV1,
	evaluateR3AdmissionV1,
} from "./r3-admission-orchestrator.js";

// multi-variant-executor (R3-S4: multi-variant test executor)
export {
	type VariantLabel,
	type PerVariantScoreSummary,
	type FlowDeskMultiVariantAggregationV1,
	type ExecuteMultiVariantTestV1Result,
	type ExecuteMultiVariantTestV1Input,
	executeMultiVariantTestV1,
} from "./multi-variant-executor.js";

// multi-model-fanout-executor (R3-S5: multi-model fanout executor)
export {
	type ElectionConfidence,
	type FlowDeskModelFanoutResultV1,
	type FlowDeskMultiModelAggregationV1,
	type FlowDeskMultiModelFanoutResultEnvelopeV1,
	type ExecuteMultiModelFanoutTestV1Input,
	executeMultiModelFanoutTestV1,
} from "./multi-model-fanout-executor.js";
