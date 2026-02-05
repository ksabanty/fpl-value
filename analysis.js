/**
 * FPL Player Analysis Module
 * Performs statistical analysis on Fantasy Premier League player data
 */

const { getAllPlayerIds, getPlayerData, getAllFixtures } = require('./requests');

class FPLAnalyzer {
    constructor() {
        this.allPlayersData = null;
        this.fixtures = null;
        this.bootstrapData = null;
    }

    /**
     * Initialize analyzer by fetching all necessary data
     */
    async initialize() {
        console.log('Initializing FPL Analyzer...');
        
        // Get bootstrap data (contains all player basic info)
        await this.loadBootstrapData();
        
        // Get fixtures data
        this.fixtures = await getAllFixtures();
        
        console.log('FPL Analyzer initialized successfully!');
    }

    /**
     * Load bootstrap data which contains all player basic information
     */
    async loadBootstrapData() {
        try {
            const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
            const data = await response.json();
            
            this.bootstrapData = data;
            this.allPlayersData = data.elements; // All player data
            
            console.log(`Loaded data for ${this.allPlayersData.length} players`);
        } catch (error) {
            console.error('Error loading bootstrap data:', error.message);
            throw error;
        }
    }

    /**
     * Check if player is currently a regular starter based on recent playing time
     */
    isRegularStarter(player) {
        // Require minimum games played
        if (player.minutes < 450) return false; // At least 5 full games
        
        // Calculate average minutes per appearance
        // A regular starter should average 60+ minutes per game
        const estimatedGamesPlayed = Math.max(1, Math.ceil(player.minutes / 90));
        const avgMinutesPerGame = player.minutes / estimatedGamesPlayed;
        
        // Check form to ensure they're playing recently
        // Form > 0 indicates they've played in recent gameweeks
        const hasRecentPlayingTime = parseFloat(player.form) !== 0 || player.minutes >= 1800;
        
        return avgMinutesPerGame >= 60 && hasRecentPlayingTime;
    }

    /**
     * Get top scorers by total points
     */
    getTopScorers(limit = 10) {
        const topScorers = this.allPlayersData
            .sort((a, b) => b.total_points - a.total_points)
            .slice(0, limit)
            .map(player => ({
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name,
                totalPoints: player.total_points,
                pointsPerGame: parseFloat(player.points_per_game),
                form: parseFloat(player.form),
                cost: player.now_cost / 10, // Convert to actual price
                selectedBy: parseFloat(player.selected_by_percent)
            }));

        return topScorers;
    }

    /**
     * Get best value players (points per million)
     */
    getBestValuePlayers(limit = 10) {
        const valuePlayers = this.allPlayersData
            .filter(player => this.isRegularStarter(player) && player.total_points > 20) // Currently playing regularly
            .map(player => ({
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name,
                totalPoints: player.total_points,
                cost: player.now_cost / 10,
                pointsPerMillion: (player.total_points / (player.now_cost / 10)).toFixed(2),
                form: parseFloat(player.form),
                selectedBy: parseFloat(player.selected_by_percent),
                minutes: player.minutes
            }))
            .filter(player => player.cost > 4.0) // Filter out very cheap players
            .sort((a, b) => b.pointsPerMillion - a.pointsPerMillion)
            .slice(0, limit);

        return valuePlayers;
    }

    /**
     * Get players by position
     */
    getPlayersByPosition(position) {
        // Position mapping: 1=GK, 2=DEF, 3=MID, 4=FWD
        const positionNames = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' };
        
        const players = this.allPlayersData
            .filter(player => player.element_type === position)
            .sort((a, b) => b.total_points - a.total_points)
            .map(player => ({
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name,
                position: positionNames[player.element_type],
                totalPoints: player.total_points,
                goalsScored: player.goals_scored,
                assists: player.assists,
                cleanSheets: player.clean_sheets,
                cost: player.now_cost / 10,
                form: parseFloat(player.form),
                minutes: player.minutes,
                selectedBy: parseFloat(player.selected_by_percent)
            }));

        return players;
    }

    /**
     * Get players in best form (last 5 games)
     */
    getBestFormPlayers(limit = 10) {
        const formPlayers = this.allPlayersData
            .filter(player => this.isRegularStarter(player) && player.total_points > 20) // Currently playing regularly with meaningful contributions
            .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
            .slice(0, limit)
            .map(player => ({
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name,
                form: parseFloat(player.form),
                totalPoints: player.total_points,
                cost: player.now_cost / 10,
                minutes: player.minutes,
                selectedBy: parseFloat(player.selected_by_percent)
            }));

        return formPlayers;
    }

    /**
     * Analyze team performance
     */
    analyzeTeamPerformance() {
        const teams = this.bootstrapData.teams;
        const teamStats = {};

        // Initialize team stats
        teams.forEach(team => {
            teamStats[team.id] = {
                name: team.name,
                totalPoints: 0,
                playerCount: 0,
                averagePoints: 0,
                totalGoals: 0,
                totalAssists: 0,
                cleanSheets: 0
            };
        });

        // Aggregate player stats by team
        this.allPlayersData.forEach(player => {
            const teamId = player.team;
            if (teamStats[teamId]) {
                teamStats[teamId].totalPoints += player.total_points;
                teamStats[teamId].playerCount += 1;
                teamStats[teamId].totalGoals += player.goals_scored;
                teamStats[teamId].totalAssists += player.assists;
                teamStats[teamId].cleanSheets += player.clean_sheets;
            }
        });

        // Calculate averages
        Object.keys(teamStats).forEach(teamId => {
            const team = teamStats[teamId];
            team.averagePoints = (team.totalPoints / team.playerCount).toFixed(1);
        });

        return Object.values(teamStats).sort((a, b) => b.totalPoints - a.totalPoints);
    }

    /**
     * Get detailed statistics for a specific player by ID
     */
    async getDetailedPlayerStats(playerId) {
        try {
            // Get basic player info from bootstrap data
            const basicInfo = this.allPlayersData.find(p => p.id === playerId);
            
            // Get detailed history data
            const detailedData = await getPlayerData(playerId);
            
            if (!basicInfo) {
                throw new Error(`Player with ID ${playerId} not found`);
            }

            return {
                basicInfo: {
                    name: `${basicInfo.first_name} ${basicInfo.second_name}`,
                    webName: basicInfo.web_name,
                    position: this.getPositionName(basicInfo.element_type),
                    team: this.getTeamName(basicInfo.team),
                    cost: basicInfo.now_cost / 10,
                    totalPoints: basicInfo.total_points,
                    form: parseFloat(basicInfo.form),
                    selectedBy: parseFloat(basicInfo.selected_by_percent)
                },
                seasonStats: {
                    goals: basicInfo.goals_scored,
                    assists: basicInfo.assists,
                    cleanSheets: basicInfo.clean_sheets,
                    minutes: basicInfo.minutes,
                    yellowCards: basicInfo.yellow_cards,
                    redCards: basicInfo.red_cards,
                    saves: basicInfo.saves,
                    bonus: basicInfo.bonus
                },
                gameweekHistory: detailedData.history || [],
                upcomingFixtures: detailedData.fixtures || [],
                previousSeasons: detailedData.history_past || []
            };

        } catch (error) {
            console.error(`Error getting detailed stats for player ${playerId}:`, error.message);
            throw error;
        }
    }

    /**
     * Helper method to get position name
     */
    getPositionName(elementType) {
        const positions = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' };
        return positions[elementType] || 'Unknown';
    }

    /**
     * Helper method to get team name
     */
    getTeamName(teamId) {
        const team = this.bootstrapData.teams.find(t => t.id === teamId);
        return team ? team.name : 'Unknown';
    }

    /**
     * Find differential picks (low ownership, high points)
     */
    getDifferentialPicks(maxOwnership = 5.0, minPoints = 50) {
        const differentials = this.allPlayersData
            .filter(player => 
                parseFloat(player.selected_by_percent) <= maxOwnership && 
                player.total_points >= minPoints &&
                this.isRegularStarter(player) // Must be currently playing regularly
            )
            .sort((a, b) => b.total_points - a.total_points)
            .map(player => ({
                name: `${player.first_name} ${player.second_name}`,
                webName: player.web_name,
                totalPoints: player.total_points,
                cost: player.now_cost / 10,
                ownership: parseFloat(player.selected_by_percent),
                form: parseFloat(player.form),
                position: this.getPositionName(player.element_type)
            }));

        return differentials;
    }

    /**
     * Print analysis results in a formatted way
     */
    printAnalysis(data, title) {
        console.log(`\n=== ${title} ===`);
        console.table(data);
    }
}

/**
 * Example usage and demonstration
 */
async function runAnalysis() {
    try {
        const analyzer = new FPLAnalyzer();
        await analyzer.initialize();

        // Top scorers analysis
        const topScorers = analyzer.getTopScorers(10);
        analyzer.printAnalysis(topScorers, 'TOP 10 SCORERS');

        // Best value players
        const valuePicksData = analyzer.getBestValuePlayers(10);
        analyzer.printAnalysis(valuePicksData, 'BEST VALUE PLAYERS (Points per Million)');

        // Best form players
        const formPlayers = analyzer.getBestFormPlayers(10);
        analyzer.printAnalysis(formPlayers, 'PLAYERS IN BEST FORM');

        // Differential picks
        const differentials = analyzer.getDifferentialPicks(5.0, 40);
        analyzer.printAnalysis(differentials.slice(0, 10), 'DIFFERENTIAL PICKS (<5% ownership)');

        // Team analysis
        const teamStats = analyzer.analyzeTeamPerformance();
        analyzer.printAnalysis(teamStats.slice(0, 10), 'TEAM PERFORMANCE');

        // Position-specific analysis
        console.log('\n=== FORWARDS ANALYSIS ===');
        const forwards = analyzer.getPlayersByPosition(4); // 4 = Forward
        console.table(forwards.slice(0, 5));

        // Detailed player analysis example (using first player)
        if (topScorers.length > 0) {
            console.log('\n=== DETAILED PLAYER ANALYSIS (Top Scorer) ===');
            // Find the player ID from bootstrap data
            const topPlayer = analyzer.allPlayersData.find(p => 
                p.total_points === topScorers[0].totalPoints
            );
            
            if (topPlayer) {
                const detailedStats = await analyzer.getDetailedPlayerStats(topPlayer.id);
                console.log('Basic Info:', detailedStats.basicInfo);
                console.log('Season Stats:', detailedStats.seasonStats);
                console.log(`Gameweek History: ${detailedStats.gameweekHistory.length} entries`);
                console.log(`Upcoming Fixtures: ${detailedStats.upcomingFixtures.length} games`);
            }
        }

    } catch (error) {
        console.error('Analysis failed:', error.message);
    }
}

// Export the analyzer class and run function
module.exports = {
    FPLAnalyzer,
    runAnalysis
};

// Run analysis if this file is executed directly
if (require.main === module) {
    runAnalysis();
}