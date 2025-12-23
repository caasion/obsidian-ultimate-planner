// PURPOSE: Provides tools to extract the desired section header and the information from the header section

import type { Element } from "src/types";

export class PlannerParser {
    static extractSection(content: string, sectionHeading: string): string[] {
        const lines = content.split('\n');
        const sectionLines: string[] = [];
        let inSection = false;

        for (const line of lines) {
            // Check if we hit our target heading
            if (line.trim() === `## ${sectionHeading}`) {
                inSection = true;
                continue;
            }
            // If we hit another heading of the same or higher level, stop
            if (inSection && line.startsWith('##')) break; 
            
            if (inSection) sectionLines.push(line);
        }
        return sectionLines;
    }

    static parseLines(lines: string[]): Element[] {
        return lines.map(line => {
            const indentLevel = line.match(/^\t*/)?.[0].length || 0;
            const isTask = line.includes('- [ ]') || line.includes('- [x]');
            
            return {
                raw: line,
                level: indentLevel,
                text: line.replace(/- \[[ x]\] |- /, '').trim(),
                isTask: isTask,
                checked: line.includes('- [x]'),
                metadata: line.match(/\[🕛: (.*?)\]/)?.[1] 
            };
        });
    }
}