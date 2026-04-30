import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { getApolloErrorMessage, isFlowMissingError } from '@/lib/apollo-error-message';

import type { FlowFormValues } from '@/features/flows/flow-form';
import type { AssistantFragmentFragment, AssistantLogFragmentFragment, FlowQuery } from '@/graphql/types';

import {
    ResultType,
    StatusType,
    useAgentLogAddedSubscription,
    useAssistantCreatedSubscription,
    useAssistantDeletedSubscription,
    useAssistantLogAddedSubscription,
    useAssistantLogsQuery,
    useAssistantLogUpdatedSubscription,
    useAssistantsQuery,
    useAssistantUpdatedSubscription,
    useCallAssistantMutation,
    useCreateAssistantMutation,
    useDeleteAssistantMutation,
    useFlowQuery,
    useFlowUpdatedSubscription,
    useMessageLogAddedSubscription,
    useMessageLogUpdatedSubscription,
    usePutUserInputMutation,
    useScreenshotAddedSubscription,
    useSearchLogAddedSubscription,
    useStopAssistantMutation,
    useStopFlowMutation,
    useTaskCreatedSubscription,
    useTaskUpdatedSubscription,
    useTerminalLogAddedSubscription,
    useVectorStoreLogAddedSubscription,
} from '@/graphql/types';
import { Log } from '@/lib/log';

interface FlowContextValue {
    assistantLogs: Array<AssistantLogFragmentFragment>;
    assistants: Array<AssistantFragmentFragment>;
    createAssistant: (values: FlowFormValues) => Promise<void>;
    deleteAssistant: (assistantId: string) => Promise<void>;
    flowData: FlowQuery | undefined;
    flowError: Error | undefined;
    flowId: null | string;
    flowStatus: StatusType | undefined;
    initiateAssistantCreation: () => void;
    isAssistantsLoading: boolean;
    isLoading: boolean;
    selectAssistant: (assistantId: null | string) => void;
    selectedAssistantId: null | string;
    stopAssistant: (assistantId: string) => Promise<void>;
    stopAutomation: () => Promise<void>;
    submitAssistantMessage: (assistantId: string, values: FlowFormValues) => Promise<void>;
    submitAutomationMessage: (values: FlowFormValues) => Promise<void>;
}

const FlowContext = createContext<FlowContextValue | undefined>(undefined);

interface FlowProviderProps {
    children: React.ReactNode;
}

export const FlowProvider = ({ children }: FlowProviderProps) => {
    const { flowId } = useParams();
    const navigate = useNavigate();

    const [selectedAssistantIds, setSelectedAssistantIds] = useState<Record<string, null | string>>({});

    const {
        data: flowData,
        error: flowError,
        loading: isLoading,
    } = useFlowQuery({
        errorPolicy: 'all',
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-first',
        notifyOnNetworkStatusChange: true,
        skip: !flowId,
        variables: { id: flowId ?? '' },
    });

    const { data: assistantsData, loading: isAssistantsLoading } = useAssistantsQuery({
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-first',
        skip: !flowId,
        variables: { flowId: flowId ?? '' },
    });

    const assistants = useMemo(() => assistantsData?.assistants ?? [], [assistantsData?.assistants]);

    const selectedAssistantId = useMemo(() => {
        if (!flowId) {
            return null;
        }

        const explicitSelection = selectedAssistantIds[flowId];

        // If there's an explicit selection (including null for "no selection")
        if (explicitSelection !== undefined) {
            // If explicitly set to null, return null
            if (explicitSelection === null) {
                return null;
            }

            // If the selected assistant still exists in the list, return it
            if (assistants.some((assistant) => assistant.id === explicitSelection)) {
                return explicitSelection;
            }
        }

        // Otherwise, auto-select the first assistant
        return assistants?.[0]?.id ?? null;
    }, [flowId, selectedAssistantIds, assistants]);

    const { data: assistantLogsData } = useAssistantLogsQuery({
        fetchPolicy: 'cache-first',
        nextFetchPolicy: 'cache-first',
        skip: !flowId || !selectedAssistantId || selectedAssistantId === '',
        variables: { assistantId: selectedAssistantId ?? '', flowId: flowId ?? '' },
    });

    // Subscriptions — skip until the initial flow query has loaded
    // to ensure cache fields exist before subscription data arrives
    const subscriptionVariables = useMemo(() => ({ flowId: flowId || '' }), [flowId]);
    const subscriptionSkip = !flowId || isLoading;

    // Global flow subscription - updates flow status (e.g., when stopped/finished)
    useFlowUpdatedSubscription();

    // Flow-specific subscriptions that depend on the selected flow
    useTaskCreatedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useTaskUpdatedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useScreenshotAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useTerminalLogAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useMessageLogUpdatedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useMessageLogAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useAgentLogAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useSearchLogAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useVectorStoreLogAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });

    // Assistant-specific subscriptions
    useAssistantCreatedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useAssistantUpdatedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useAssistantDeletedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useAssistantLogAddedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });
    useAssistantLogUpdatedSubscription({ skip: subscriptionSkip, variables: subscriptionVariables });

    const selectAssistant = useCallback(
        (assistantId: null | string) => {
            if (!flowId) {
                return;
            }

            setSelectedAssistantIds((prev) => ({
                ...prev,
                [flowId]: assistantId,
            }));
        },
        [flowId],
    );

    const initiateAssistantCreation = useCallback(() => {
        if (!flowId) {
            return;
        }

        selectAssistant(null);
    }, [flowId, selectAssistant]);

    // Mutations
    const [putUserInput] = usePutUserInputMutation();
    const [stopFlowMutation] = useStopFlowMutation();
    const [createAssistantMutation] = useCreateAssistantMutation();
    const [submitAssistantMessageMutation] = useCallAssistantMutation();
    const [stopAssistantMutation] = useStopAssistantMutation();
    const [deleteAssistantMutation] = useDeleteAssistantMutation();

    const flowStatus = useMemo(() => flowData?.flow?.status, [flowData?.flow?.status]);

    const notifyFlowMutationError = useCallback(
        (error: unknown, title: string, fallback: string) => {
            const msg = getApolloErrorMessage(error, fallback);
            toast.error(`${title}: ${msg}`);
            if (isFlowMissingError(msg)) {
                navigate('/flows', { replace: true });
            }
            Log.error(`${title}:`, error);
        },
        [navigate],
    );

    // Show toast notification when flow loading error occurs
    useEffect(() => {
        if (flowError) {
            const description = flowError.message || 'An error occurred while loading flow';
            toast.error('Failed to load flow', {
                description,
            });
            Log.error('Error loading flow:', flowError);
        }
    }, [flowError]);

    const submitAutomationMessage = useCallback(
        async (values: FlowFormValues) => {
            if (!flowId || flowStatus === StatusType.Finished) {
                return;
            }
            if (isLoading) {
                return;
            }
            if (!flowData?.flow) {
                toast.error('Flow not available', {
                    description: 'Open it again from the flows list.',
                });
                navigate('/flows', { replace: true });
                return;
            }

            const { message: input, providerName } = values;

            try {
                await putUserInput({
                    variables: {
                        flowId,
                        input,
                        modelProvider: providerName || undefined,
                    },
                });
            } catch (error) {
                notifyFlowMutationError(error, 'Failed to submit message', 'An error occurred while submitting message');
            }
        },
        [flowId, flowStatus, flowData?.flow, isLoading, navigate, notifyFlowMutationError, putUserInput],
    );

    const stopAutomation = useCallback(async () => {
        if (!flowId) {
            return;
        }

        try {
            await stopFlowMutation({
                variables: {
                    flowId,
                },
            });
        } catch (error) {
            notifyFlowMutationError(error, 'Failed to stop flow', 'An error occurred while stopping flow');
        }
    }, [flowId, notifyFlowMutationError, stopFlowMutation]);

    const createAssistant = useCallback(
        async (values: FlowFormValues) => {
            const { message, providerName, useAgents } = values;

            const input = message.trim();
            const modelProvider = providerName.trim();

            if (!input || !modelProvider || !flowId) {
                return;
            }

            try {
                const { data } = await createAssistantMutation({
                    variables: {
                        flowId,
                        input,
                        modelProvider,
                        useAgents,
                    },
                });

                if (data?.createAssistant) {
                    const { assistant } = data.createAssistant;

                    if (assistant?.id) {
                        selectAssistant(assistant.id);
                    }
                }
            } catch (error) {
                notifyFlowMutationError(error, 'Failed to create assistant', 'An error occurred while creating assistant');
            }
        },
        [flowId, createAssistantMutation, notifyFlowMutationError, selectAssistant],
    );

    const submitAssistantMessage = useCallback(
        async (assistantId: string, values: FlowFormValues) => {
            const { message, useAgents } = values;

            const input = message.trim();

            if (!flowId || !assistantId || !input) {
                return;
            }

            try {
                await submitAssistantMessageMutation({
                    variables: {
                        assistantId,
                        flowId,
                        input,
                        useAgents,
                    },
                });
                // Cache will be automatically updated via subscriptions
            } catch (error) {
                notifyFlowMutationError(error, 'Failed to call assistant', 'An error occurred while calling assistant');
            }
        },
        [flowId, notifyFlowMutationError, submitAssistantMessageMutation],
    );

    const stopAssistant = useCallback(
        async (assistantId: string) => {
            if (!flowId || !assistantId) {
                return;
            }

            try {
                await stopAssistantMutation({
                    variables: {
                        assistantId,
                        flowId,
                    },
                });
                // Cache will be automatically updated via mutation policy and subscriptions
            } catch (error) {
                notifyFlowMutationError(error, 'Failed to stop assistant', 'An error occurred while stopping assistant');
            }
        },
        [flowId, notifyFlowMutationError, stopAssistantMutation],
    );

    const deleteAssistant = useCallback(
        async (assistantId: string) => {
            if (!flowId || !assistantId) {
                return;
            }

            try {
                const wasSelected = selectedAssistantId === assistantId;

                await deleteAssistantMutation({
                    optimisticResponse: {
                        deleteAssistant: ResultType.Success,
                    },
                    variables: {
                        assistantId,
                        flowId,
                    },
                });

                if (wasSelected) {
                    selectAssistant(null);
                }
            } catch (error) {
                notifyFlowMutationError(error, 'Failed to delete assistant', 'An error occurred while deleting assistant');
            }
        },
        [flowId, selectedAssistantId, deleteAssistantMutation, notifyFlowMutationError, selectAssistant],
    );

    const value = useMemo(
        () => ({
            assistantLogs: assistantLogsData?.assistantLogs ?? [],
            assistants,
            createAssistant,
            deleteAssistant,
            flowData,
            flowError,
            flowId: flowId ?? null,
            flowStatus,
            initiateAssistantCreation,
            isAssistantsLoading,
            isLoading,
            selectAssistant,
            selectedAssistantId,
            stopAssistant,
            stopAutomation,
            submitAssistantMessage,
            submitAutomationMessage,
        }),
        [
            assistantLogsData?.assistantLogs,
            assistants,
            createAssistant,
            deleteAssistant,
            flowData,
            flowError,
            flowId,
            flowStatus,
            initiateAssistantCreation,
            isAssistantsLoading,
            isLoading,
            selectAssistant,
            selectedAssistantId,
            stopAssistant,
            stopAutomation,
            submitAssistantMessage,
            submitAutomationMessage,
        ],
    );

    return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};

export const useFlow = () => {
    const context = useContext(FlowContext);

    if (context === undefined) {
        throw new Error('useFlow must be used within FlowProvider');
    }

    return context;
};
