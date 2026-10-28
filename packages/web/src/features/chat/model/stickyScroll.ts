'use client';

import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import type { ChannelViewportAnchor } from './channelViewportAnchor';

const DEFAULT_THRESHOLD = 120;

interface ScrollMetrics {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
}

export function isNearBottom(metrics: ScrollMetrics, threshold = DEFAULT_THRESHOLD) {
    const distanceFromBottom = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
    return distanceFromBottom <= threshold;
}

export function didAppendNewItem(previousIds: string[], nextIds: string[]) {
    if (nextIds.length <= previousIds.length) return false;
    if (previousIds.length === 0) return true;
    return previousIds[previousIds.length - 1] !== nextIds[nextIds.length - 1];
}

export function didPrependItems(previousIds: string[], nextIds: string[]) {
    if (previousIds.length === 0 || nextIds.length <= previousIds.length) return false;
    return previousIds.every((id, index) => nextIds[nextIds.length - previousIds.length + index] === id);
}

function getScrollMetrics(container: HTMLElement) {
    return {
        clientHeight: container.clientHeight,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
    };
}

interface Options {
    itemIds: string[];
    scrollThreshold?: number;
    ready?: boolean;
    restoreAnchor?: ChannelViewportAnchor | null;
}

interface Result {
    bottomRef: RefObject<HTMLDivElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    handleScroll: () => void;
    prepareForPrepend: () => void;
    scrollToBottom: () => void;
    showJumpToLatest: boolean;
}

export function useStickyScroll({
    itemIds,
    scrollThreshold = DEFAULT_THRESHOLD,
    ready = true,
    restoreAnchor,
}: Options): Result {
    const containerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const previousItemIdsRef = useRef<string[]>([]);
    const isNearBottomRef = useRef(true);
    const prependSnapshotRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
    const initializedRef = useRef(false);
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);

    const scrollToBottom = () => {
        const container = containerRef.current;
        container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        isNearBottomRef.current = true;
        setShowJumpToLatest(false);
    };

    const handleScroll = () => {
        const container = containerRef.current;
        if (!container) return;

        const nearBottom = isNearBottom(getScrollMetrics(container), scrollThreshold);
        isNearBottomRef.current = nearBottom;
        if (nearBottom) {
            setShowJumpToLatest(false);
        }
    };

    const prepareForPrepend = () => {
        const container = containerRef.current;
        if (!container) return;
        prependSnapshotRef.current = {
            scrollHeight: container.scrollHeight,
            scrollTop: container.scrollTop,
        };
    };

    useLayoutEffect(() => {
        const container = containerRef.current;
        // Loading renders a spinner instead of the scroller. Do not consume first load.
        if (!ready || !container || itemIds.length === 0) return;
        const previousItemIds = previousItemIdsRef.current;
        const firstLoad = !initializedRef.current;
        const appendedNewItem = didAppendNewItem(previousItemIds, itemIds);
        const prependedItems = didPrependItems(previousItemIds, itemIds);
        if (firstLoad) {
            const target =
                restoreAnchor &&
                Array.from(container.querySelectorAll<HTMLElement>('[id]')).find(
                    (element) => element.id === `message-${restoreAnchor.messageId}`,
                );
            if (target && !restoreAnchor?.atBottom) {
                container.scrollTop +=
                    target.getBoundingClientRect().top -
                    container.getBoundingClientRect().top -
                    (restoreAnchor?.offset ?? 0);
            } else {
                container.scrollTop = container.scrollHeight;
            }
            initializedRef.current = true;
            isNearBottomRef.current = isNearBottom(getScrollMetrics(container), scrollThreshold);
            setShowJumpToLatest(!isNearBottomRef.current);
            previousItemIdsRef.current = itemIds;
            return;
        }

        if (prependedItems && prependSnapshotRef.current && container) {
            const delta = container.scrollHeight - prependSnapshotRef.current.scrollHeight;
            container.scrollTop = prependSnapshotRef.current.scrollTop + delta;
            prependSnapshotRef.current = null;
            previousItemIdsRef.current = itemIds;
            return;
        }

        prependSnapshotRef.current = null;

        if (isNearBottomRef.current) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            setShowJumpToLatest(false);
        } else if (appendedNewItem) {
            setShowJumpToLatest(true);
        }

        previousItemIdsRef.current = itemIds;
    }, [itemIds, ready, restoreAnchor, scrollThreshold]);

    return {
        bottomRef,
        containerRef,
        handleScroll,
        prepareForPrepend,
        scrollToBottom,
        showJumpToLatest,
    };
}
