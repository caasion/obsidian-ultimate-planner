// PURPOSE: Provides tools to extract the desired section header and the information from the header section

import { formatProgressDuration, formatTime } from "src/plugin/helpers";
import type { Element, Habit, Phase, Time, Track, TrackData } from "src/plugin/types";
import { RRuleService } from "src/tracks/logic/rrule";

export class PlannerParser {
    // ===== Reading - Extraction ===== //

    static extractFirstSection(content: string): string {
        const lines = content.replace(/^---[\s\S]*?---\s*/, '').split('\n');
        let sectionLines: string[] = [];

        for (const line of lines) {
            const headerMatch = line.match(/^(#{1,6})\s+(.*)/);

            if (headerMatch) break;

            sectionLines.push(line);
        }

        return sectionLines.join('\n')
        
    }

    static extractSection(content: string, headerText: string): string {
        const lines = content.split('\n');
        let sectionLines: string[] = [];
        let inSection = false;
        let currentLevel = 0;

        for (const line of lines) {
            // Detect header of any level
            const headerMatch = line.match(/^(#{1,6})\s+(.*)/);

            if (headerMatch) {
                const level = headerMatch[1].length;
                const text = headerMatch[2].trim();

                if (inSection && level <= currentLevel) break;

                if (text === headerText) {
                    inSection = true;
                    currentLevel = level;
                    continue;
                }
            }
            
            if (inSection) sectionLines.push(line);
        }
        return sectionLines.join('\n');
    }

    // ===== Reading - Parsing ===== //

    static parseJournalSection(section: string): Record<string, string> {
        const lines = section.split('\n');
        const journalData: Record<string, string> = {};
        let currJournal: string | null = null;
        let currJournalData: string[] = [];

        for (const line of lines) {
            // Skip empty lines or lines that aren't bullet points
			if (!line || !line.match(/^\t*- /)) continue;

            if (line.match(/^- /)) {
                if (currJournal && currJournalData) journalData[currJournal] = currJournalData.join('\n');
                if (currJournal && !currJournalData) journalData[currJournal] = "";

                currJournal = null;
                currJournalData = [];
                
                let text = line.replace(/^- /, '').trim();
                currJournal = text;
            } else if (line.match(/^\t+- /)) {
                if (!currJournal) continue;

                let text = line.replace(/^\t- /, '').trim();
                currJournalData.push(text);
            }
        }

        if (currJournal) journalData[currJournal] = currJournalData.join('\n');

        return journalData;
    }

    static parseHabitSection(section: string): Record<string, Habit> {
        const lines = section.split('\n');
        const habits: Record<string, Habit> = {};

        for (const line of lines) {
            // Skip empty lines or lines that aren't bullet points
            if (!line || !line.match(/^- /)) continue;

            let text = line.replace(/^- /, '').trim();
            let label: string = text;
            let rrule: string = '';
            
            // Extract rrule from pattern: Label (FREQ=DAILY;BYDAY=MO,WE,FR)
            const rruleRegex = /\[([^\]]*)\]\s*$/;

            const rruleMatch = text.match(rruleRegex);
            if (rruleMatch) {
                const [fullMatch, rruleContent] = rruleMatch;
                label = text.replace(fullMatch, '').trim();
                rrule = RRuleService.parseRRule(rruleContent);
            }

            // Generate stable index-based ID so re-parses don't create duplicates
            const id = `habit-${Object.keys(habits).length}`;
            
            habits[id] = {
                id,
                raw: '- ' + text,
                label,
                rrule
            };
        }

        return habits;
    }

    static parsePhasesSection(section: string): Phase[] {
        const lines = section.split('\n');
        const phases: Phase[] = [];
        let current: { label: string; startDate?: string; endDate?: string; elements: Element[]; currentElement: Element | null } | null = null;

        const startRegex = /^\[start::\s*(\S+)\]\s*$/;
        const endRegex = /^\[end::\s*(\S+)\]\s*$/;

        for (const line of lines) {
            const headerMatch = line.match(/^###\s+(.*)/);
            if (headerMatch) {
                // Finalize previous phase
                if (current) {
                    if (current.currentElement) current.elements.push(current.currentElement);
                    phases.push({
                        id: `phase-${phases.length}`,
                        label: current.label,
                        startDate: current.startDate,
                        endDate: current.endDate,
                        data: current.elements,
                    });
                }
                current = { label: headerMatch[1].trim(), elements: [], currentElement: null };
                continue;
            }

            if (!current) continue;

            const startMatch = line.match(startRegex);
            if (startMatch) {
                current.startDate = startMatch[1];
                continue;
            }

            const endMatch = line.match(endRegex);
            if (endMatch) {
                current.endDate = endMatch[1];
                continue;
            }

            // Task lines
            if (line.match(/^- /)) {
                if (current.currentElement) current.elements.push(current.currentElement);
                current.currentElement = PlannerParser.parseElementLine(line);
            } else if (line.match(/^\t- /) && current.currentElement) {
                const text = line.replace(/^\t- /, '').trim();
                current.currentElement.children.push(text);
            }
        }

        // Finalize last phase
        if (current) {
            if (current.currentElement) current.elements.push(current.currentElement);
            phases.push({
                id: `phase-${phases.length}`,
                label: current.label,
                startDate: current.startDate,
                endDate: current.endDate,
                data: current.elements,
            });
        }

        return phases;
    }

    static serializePhasesSection(phases: Phase[]): string {
        let result = '';
        for (const phase of phases) {
            result += `### ${phase.label}\n`;
            if (phase.startDate) result += `[start:: ${phase.startDate}]\n`;
            if (phase.endDate) result += `[end:: ${phase.endDate}]\n`;
            result += '\n';
            for (const element of phase.data) {
                result += PlannerParser.serializeProjectElement(element);
            }
        }
        return result;
    }

    static parseTaskSection(section: string): Element[] {
        const lines = section.split('\n');
        const tasks: Element[] = [];
        let currentElement: Element | null = null;

        for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;

            // Top-level element (no tabs or single-level tabs)
            if (line.match(/^- /)) {
                // Push previous element if exists
                if (currentElement) {
                    tasks.push(currentElement);
                }
                
                // Parse new element
                currentElement = PlannerParser.parseElementLine(line);
            } else if (line.match(/^\t- /) && currentElement) {
                // Child item
                const text = line.replace(/^\t- /, '').trim();
                currentElement.children.push(text);
            }
        }

        // Push last element
        if (currentElement) {
            tasks.push(currentElement);
        }

        return tasks;
    }

    private static resolveTrackId(label: string, tracks: Record<string, Track>): string {
        const normalizedLabel = label.trim().toLocaleLowerCase();

        if (tracks[label]) return label;
        if (tracks[label.trim()]) return label.trim();

        for (const [trackId, trackMeta] of Object.entries(tracks)) {
            if (trackMeta.label.trim().toLocaleLowerCase() === normalizedLabel) {
                return trackId;
            }
        }

        return label.trim();
    }
    
    static parseTrackSection(section: string, tracks: Record<string, Track>): Record<string, TrackData> {
	    const lines = section.split('\n');
        const trackData: Record<string, TrackData> = {};
        let currTrack: TrackData | null = null;
		let currElement: Element | null = null; 
		
		for (let line of lines) {
			// Skip empty lines or lines that aren't bullet points
			if (!line || !line.match(/^\t*- /)) continue;
			
			// If the line starts with a bullet point with no tab, then start a new item.
			if (line.match(/^- /)) { 
				// Push the old element or item if it exists
                if (currElement && currTrack) currTrack.items.push(currElement);
                if (currTrack) trackData[currTrack.id] = currTrack;
				
				// Prepare for new item: reset & initialize
				currElement = null;
				let text = line.replace(/^- (\[.\] )?/, '').trim();
				
				// Parse time commitment from pattern: Action Item (2 hr|30 mins)
				let timeCommitment = 60; // default
				const timeMatch = text.match(/\((\d+)\s*(h|hr|hrs|m|min|mins)\)/);
				if (timeMatch) {
					const [fullMatch, rawDuration, units] = timeMatch;
					const duration = parseInt(rawDuration);
					// Convert to minutes
					timeCommitment = units.startsWith('h') ? duration * 60 : duration;
					// Remove the time commitment from the text
					text = text.replace(fullMatch, '').trim();
				}
				
                currTrack = {
                    id: PlannerParser.resolveTrackId(text, tracks),
					time: timeCommitment,
					items: [],
				}
				
			} else if (line.match(/^\t- /)) {
				// Push the old element if it exists
                if (currElement && currTrack) currTrack.items.push(currElement);
				
				// Initialize the new element
				currElement = PlannerParser.parseElementLine(line);
				
			} else if (line.match(/^\t\t- /)) {
				if (currElement) {
					const text = line.replace(/^\t\t- /, '').trim();
					currElement.children.push(text);
				}
			}
		}

        // Push the old element if it exists
        if (currElement && currTrack) currTrack.items.push(currElement);

        // Push the old item if it exists
        if (currTrack) trackData[currTrack.id] = currTrack;

        return trackData;
    }

    static parseElementLine(line: string): Element {
		let text = line.replace(/^\s*- /, '');

	    let isTask = false;
		let taskStatus: ' ' | 'x' | '-' | undefined;
		let startTime: Time | undefined;
		let progress: number | undefined;
		let duration: number | undefined;
		let timeUnit: 'min' | 'hr' | undefined;

		const taskStatusRegex = /^\[([ x-])\]/;
		const startTimeRegex = /@\s*(\d{1,2}):(\d{2})/;
		const progressDurationRegex = /\[(?:(\d+)?(\/))?(\d+)\s*(hr|min)\]/;

		const taskStatusMatch = text.match(taskStatusRegex);
		if (taskStatusMatch) {
			const [fullMatch, checkmark] = taskStatusMatch;
			text = text.replace(fullMatch, '').trim();
			isTask = true;
			taskStatus = checkmark as typeof taskStatus;
		}

		const startTimeMatch = text.match(startTimeRegex);
		if (startTimeMatch) {
			const [fullMatch, hours, minutes] = startTimeMatch;
			text = text.replace(fullMatch, '').trim();
			startTime = { hours: parseInt(hours), minutes: parseInt(minutes) };
		}

		const progressDurationMatch = text.match(progressDurationRegex);
		if (progressDurationMatch) {
			const [fullMatch, progressMatch, hasProgress, durationMatch, unitMatch] = progressDurationMatch;
			text = text.replace(fullMatch, '');
			progress = hasProgress ? (parseInt(progressMatch) || 0) : undefined;
			duration = parseInt(durationMatch);
			timeUnit = unitMatch as 'min' | 'hr';
		}

		return {
			raw: line,
			text,
			children: [],
			isTask,
			taskStatus,
			startTime, 
			progress,
			duration,
			timeUnit,
		};
    }

    // ===== Writing - Serialization ===== // 

    // Serialize an Element back to a string (used for track-level items, indented with \t)
    static serializeElement(element: Element | Omit<Element, 'raw'>): string {
        return PlannerParser.serializeElementWithIndent(element, '\t- ', '\t\t- ');
    }

    // Serialize an Element for project data (top-level, no indent)
    static serializeProjectElement(element: Element | Omit<Element, 'raw'>): string {
        return PlannerParser.serializeElementWithIndent(element, '- ', '\t- ');
    }

    private static serializeElementWithIndent(
        element: Element | Omit<Element, 'raw'>,
        linePrefix: string,
        childPrefix: string
    ): string {
        let line = linePrefix;

		const { text, children, isTask, taskStatus, startTime, progress, duration, timeUnit } = element;

		if (isTask) 
			line += `[${taskStatus}] `
        
        line += text.trim();

		if (startTime)
			line += ' @ ' + formatTime(startTime);

		if (duration && timeUnit) 
			line += ' ' + formatProgressDuration(progress, duration, timeUnit);

		let result = line + `\n`;

		for (const child of children) {
            result += `${childPrefix}${child}\n`;
        }
        
        return result;
    }
    
    // Serialize a single track cell back to string
    private static serializeTrack(trackMeta: Track, trackData: TrackData): string {
        let result = '';
        
        // Add track header with label
        result += `- ${trackMeta.label}`;
        
        // Add time commitment if not default (60 minutes)
        if (trackData.time && trackData.time !== 60) {
            if (trackData.time % 60 === 0) {
                // Display in hours if it's a whole number of hours
                result += ` (${trackData.time / 60} hr)`;
            } else {
                // Display in minutes
                result += ` (${trackData.time} min)`;
            }
        }
        
        result += '\n';
        
        // Add all elements
        for (const element of trackData.items) {
            result += PlannerParser.serializeElement(element);
        }
        
        return result;
    }
    
    // Serialize entire section back to string
    static serializeTrackSection(tracks: Record<string, Track>, tracksData: Record<string, TrackData>): string {
        // Sort items by order from template
        const sortedTrackIds = Object.keys(tracks).sort((a, b) => {
            const orderA = tracks[a]?.order ?? 999;
            const orderB = tracks[b]?.order ?? 999;
            return orderA - orderB;
        });
        
        let result = '';
        
        for (const trackId of sortedTrackIds) {
            const trackMeta = tracks[trackId];
            const trackData = tracksData[trackId];
            
            if (trackMeta && trackData) {
                result += PlannerParser.serializeTrack(trackMeta, trackData);
            }
        }
        
        return result;
    }

    static serializeHabits(habits: Record<string, Habit>): string {
        let result = '';
        for (const habit of Object.values(habits)) {
            result += habit.raw + '\n';
        }
        return result;
    }

    // ===== Writing - Replacing ===== //
    
    // Replace a section in the full file content
    static replaceSection(content: string, sectionHeading: string, newSectionContent: string): string {
        const lines = content.split('\n');
        let result: string[] = [];
        let inSection = false;
        let sectionAdded = false;
        let sectionLevel = 2;

        for (const line of lines) {
            const headerMatch = line.match(/^(#{1,6})\s+(.*)/);

            if (!inSection && headerMatch) {
                const level = headerMatch[1].length;
                const text = headerMatch[2].trim();
                if (text === sectionHeading) {
                    result.push(line);
                    result.push(newSectionContent);
                    inSection = true;
                    sectionLevel = level;
                    sectionAdded = true;
                    continue;
                }
            }

            // Only stop skipping when we hit a heading at the same or higher level
            if (inSection && headerMatch && headerMatch[1].length <= sectionLevel) {
                inSection = false;
            }

            // Skip lines that are in the section (they'll be replaced)
            if (inSection) continue;

            result.push(line);
        }
        
        // If section wasn't found, add it at the end
        if (!sectionAdded) {
            result.push('');
            result.push(`## ${sectionHeading}`);
            result.push(newSectionContent);
        }
        
        return result.join('\n');
    }

    static replaceFirstSection(content: string, newSectionContent: string) {
        const lines = content.split('\n');
        let result: string[] = [];
        let frontmatterEnd = -1;
        let inFrontmatter = false;
        
        // Find frontmatter end
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === '---') {
                if (!inFrontmatter) {
                    inFrontmatter = true;
                } else {
                    frontmatterEnd = i;
                    break;
                }
            }
        }
        
        if (frontmatterEnd === -1) {
            console.warn('No frontmatter found');
            return content;
        }
        
        // Add frontmatter
        result.push(...lines.slice(0, frontmatterEnd + 1));
        result.push('');
        
        // Add new description
        result.push(newSectionContent);
        result.push('');
        
        // Find and add first section (and everything after)
        let firstSectionIndex = -1;
        for (let i = frontmatterEnd + 1; i < lines.length; i++) {
            if (lines[i].match(/^#{1,6}\s+/)) {
                firstSectionIndex = i;
                break;
            }
        }
        
        if (firstSectionIndex !== -1) {
            result.push(...lines.slice(firstSectionIndex));
        }
        
        return result.join('\n');
    }
}