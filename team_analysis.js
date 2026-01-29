/**
 * FPL Team Defense Analysis Module
 * Analyzes which teams allow the most FPL points to each positional group
 */

const { getAllPlayerIds, getPlayerData } = require('./requests');

class TeamDefenseAnalyzer {
    constructor() {
        this.bootstrapData = null;
        this.allPlayersData = null;
        this.teams = null;
        this.teamDefenseStats = {
            1: {}, // Goalkeepers
            2: {}, // Defenders  
            3: {}, // Midfielders
            4: {}  // Forwards
        };
    }

    /**
     * Initialize analyzer by fetching bootstrap data
     */
    async initialize() {
        console.log('Initializing Team Defense Analyzer...');
        
        await this.loadBootstrapData();
        
        // Initialize team defense stats for each position
        this.teams.forEach(team => {
            this.teamDefenseStats[1][team.id] = { name: team.name, pointsAllowed: 0, games: 0 };
            this.teamDefenseStats[2][team.id] = { name: team.name, pointsAllowed: 0, games: 0 };
            this.teamDefenseStats[3][team.id] = { name: team.name, pointsAllowed: 0, games: 0 };
            this.teamDefenseStats[4][team.id] = { name: team.name, pointsAllowed: 0, games: 0 };
        });
        
        console.log('Team Defense Analyzer initialized successfully!');
    }

    /**
     * Load bootstrap data which contains all player basic information
     */
    async loadBootstrapData() {
        try {
            const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
            const data = await response.json();
            
            this.bootstrapData = data;
            this.allPlayersData = data.elements;
            this.teams = data.teams;
            
            console.log(`Loaded data for ${this.allPlayersData.length} players and ${this.teams.length} teams`);
        } catch (error) {
            console.error('Error loading bootstrap data:', error.message);
            throw error;
        }
    }

    /**
     * Analyze defense performance by fetching all player gameweek data
     */
    async analyzeTeamDefense() {
        console.log('Starting comprehensive team defense analysis...');
        console.log('This may take a few minutes as we need to fetch data for all players...\n');

        const playerIds = this.allPlayersData.map(p => p.id);
        const totalPlayers = playerIds.length;
        let processedPlayers = 0;

        // Process players in batches to avoid overwhelming the API
        const batchSize = 50;
        
        for (let i = 0; i < playerIds.length; i += batchSize) {
            const batch = playerIds.slice(i, i + batchSize);
            
            // Process batch with slight delays between requests
            const batchPromises = batch.map((playerId, index) => {
                return new Promise(async (resolve) => {
                    // Add a small delay to avoid rate limiting
                    setTimeout(async () => {
                        try {
                            await this.processPlayerData(playerId);
                            processedPlayers++;
                            
                            // Log progress every 50 players
                            if (processedPlayers % 50 === 0 || processedPlayers === totalPlayers) {
                                console.log(`Progress: ${processedPlayers}/${totalPlayers} players processed (${((processedPlayers/totalPlayers)*100).toFixed(1)}%)`);
                            }
                            
                            resolve();
                        } catch (error) {
                            console.error(`Error processing player ${playerId}:`, error.message);
                            processedPlayers++;
                            resolve();
                        }
                    }, index * 100); // 100ms delay between each request in batch
                });
            });

            await Promise.all(batchPromises);
            
            // Longer delay between batches
            if (i + batchSize < playerIds.length) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
            }
        }

        console.log('\nAnalysis complete! Calculating results...\n');
        return this.calculateResults();
    }

    /**
     * Process individual player data to extract points scored against each opponent
     */
    async processPlayerData(playerId) {
        const playerInfo = this.allPlayersData.find(p => p.id === playerId);
        if (!playerInfo) return;

        const playerData = await getPlayerData(playerId);
        const playerPosition = playerInfo.element_type;
        const playerTeamId = playerInfo.team;

        // Process each gameweek in the player's history
        if (playerData.history && playerData.history.length > 0) {
            playerData.history.forEach(gameweek => {
                // Get the opponent team ID
                const opponentTeamId = gameweek.opponent_team;
                
                // Only count games where the player actually played
                if (gameweek.minutes > 0 && opponentTeamId && this.teamDefenseStats[playerPosition][opponentTeamId]) {
                    this.teamDefenseStats[playerPosition][opponentTeamId].pointsAllowed += gameweek.total_points;
                    this.teamDefenseStats[playerPosition][opponentTeamId].games += 1;
                }
            });
        }
    }

    /**
     * Calculate and sort results for each position
     */
    calculateResults() {
        const results = {
            goalkeepers: [],
            defenders: [],
            midfielders: [],
            forwards: []
        };

        const positionMapping = {
            1: 'goalkeepers',
            2: 'defenders', 
            3: 'midfielders',
            4: 'forwards'
        };

        // Calculate averages and sort for each position
        Object.keys(this.teamDefenseStats).forEach(position => {
            const positionName = positionMapping[position];
            const teams = this.teamDefenseStats[position];
            
            const sortedTeams = Object.values(teams)
                .filter(team => team.games > 0) // Only include teams that have played games
                .map(team => ({
                    name: team.name,
                    totalPointsAllowed: team.pointsAllowed,
                    gamesPlayed: team.games,
                    avgPointsAllowedPerGame: (team.pointsAllowed / team.games).toFixed(2)
                }))
                .sort((a, b) => b.totalPointsAllowed - a.totalPointsAllowed);
            
            results[positionName] = sortedTeams;
        });

        return results;
    }

    /**
     * Display results in a formatted way
     */
    displayResults(results) {
        console.log('='.repeat(80));
        console.log('FPL TEAM DEFENSE ANALYSIS - POINTS ALLOWED BY POSITION');
        console.log('='.repeat(80));

        const positions = ['forwards', 'midfielders', 'defenders', 'goalkeepers'];
        
        positions.forEach(position => {
            const positionTitle = position.toUpperCase();
            const teams = results[position];
            
            console.log(`\n📊 POINTS ALLOWED TO ${positionTitle}:`);
            console.log('-'.repeat(50));
            
            if (teams.length > 0) {
                // Show summary line
                const topTeams = teams.slice(0, 5).map(team => team.name).join(', ');
                console.log(`Most vulnerable: ${topTeams}`);
                
                console.log('\nDetailed Rankings:');
                teams.forEach((team, index) => {
                    const rank = index + 1;
                    console.log(`${rank.toString().padStart(2)}. ${team.name.padEnd(20)} | Total: ${team.totalPointsAllowed.toString().padStart(4)} pts | Games: ${team.gamesPlayed.toString().padStart(3)} | Avg: ${team.avgPointsAllowedPerGame} pts/game`);
                });
            } else {
                console.log('No data available for this position.');
            }
            
            console.log(''); // Empty line for spacing
        });

        // Summary section
        console.log('='.repeat(80));
        console.log('SUMMARY - MOST VULNERABLE TEAMS BY POSITION');
        console.log('='.repeat(80));
        
        positions.forEach(position => {
            const teams = results[position];
            if (teams.length > 0) {
                const top5Teams = teams.slice(0, 5).map(team => team.name).join(', ');
                console.log(`${position.toUpperCase()}: ${top5Teams}`);
            }
        });
        
        console.log('\n💡 TIP: Target players facing teams that appear frequently in these lists!');
        console.log('='.repeat(80));
    }

    /**
     * Get top vulnerable teams for a specific position
     */
    getTopVulnerableTeams(results, position, limit = 5) {
        const teams = results[position] || [];
        return teams.slice(0, limit).map(team => ({
            name: team.name,
            totalPoints: team.totalPointsAllowed,
            avgPoints: team.avgPointsAllowedPerGame
        }));
    }
}

/**
 * Player Fixture Analyzer - Recommends players based on upcoming fixtures
 */
class PlayerFixtureAnalyzer {
    constructor(defenseResults) {
        this.defenseResults = defenseResults;
        this.allPlayersData = null;
        this.fixtures = null;
        this.bootstrapData = null;
    }

    /**
     * Initialize with data
     */
    async initialize() {
        console.log('Initializing Player Fixture Analyzer...');
        
        // Load bootstrap data
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        const data = await response.json();
        
        this.bootstrapData = data;
        this.allPlayersData = data.elements;
        
        // Load fixtures
        const fixturesResponse = await fetch('https://fantasy.premierleague.com/api/fixtures/');
        this.fixtures = await fixturesResponse.json();
        
        console.log('Player Fixture Analyzer initialized!');
    }

    /**
     * Get vulnerability score for a team against a specific position
     */
    getVulnerabilityScore(teamId, position) {
        const positionMap = {
            1: 'goalkeepers',
            2: 'defenders', 
            3: 'midfielders',
            4: 'forwards'
        };
        
        const positionData = this.defenseResults[positionMap[position]];
        const teamData = positionData.find(team => {
            const bootstrapTeam = this.bootstrapData.teams.find(t => t.name === team.name);
            return bootstrapTeam && bootstrapTeam.id === teamId;
        });
        
        if (!teamData) return 0;
        
        // Convert average points to a 0-10 vulnerability score
        const avgPoints = parseFloat(teamData.avgPointsAllowedPerGame);
        return Math.min(10, Math.max(0, avgPoints * 2.5)); // Scale 0-4 pts/game to 0-10 score
    }

    /**
     * Get current gameweek
     */
    getCurrentGameweek() {
        // Find the current gameweek from fixtures
        const currentDate = new Date();
        const upcomingFixtures = this.fixtures
            .filter(f => f.finished === false && f.started === false)
            .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));
        
        if (upcomingFixtures.length > 0) {
            return upcomingFixtures[0].event;
        }
        
        // Fallback - find the highest gameweek number
        const maxGameweek = Math.max(...this.fixtures.map(f => f.event || 0));
        return Math.min(38, maxGameweek + 1);
    }

    /**
     * Get upcoming fixtures for a player within specified gameweeks
     */
    getPlayerUpcomingFixtures(playerId, gameweeksAhead) {
        const player = this.allPlayersData.find(p => p.id === playerId);
        if (!player) return [];

        const currentGameweek = this.getCurrentGameweek();
        const targetGameweeks = Array.from(
            {length: gameweeksAhead}, 
            (_, i) => currentGameweek + i
        );

        return this.fixtures
            .filter(fixture => {
                return targetGameweeks.includes(fixture.event) &&
                       (fixture.team_a === player.team || fixture.team_h === player.team) &&
                       !fixture.finished;
            })
            .map(fixture => {
                const isHome = fixture.team_h === player.team;
                const opponentId = isHome ? fixture.team_a : fixture.team_h;
                const opponent = this.bootstrapData.teams.find(t => t.id === opponentId);
                
                return {
                    gameweek: fixture.event,
                    opponent: opponent ? opponent.name : 'Unknown',
                    opponentId: opponentId,
                    isHome: isHome,
                    difficulty: isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty,
                    vulnerabilityScore: this.getVulnerabilityScore(opponentId, player.element_type)
                };
            })
            .sort((a, b) => a.gameweek - b.gameweek);
    }

    /**
     * Analyze and rank players for different time horizons
     */
    getPlayerRecommendations(timeHorizons = [1, 3, 5]) {
        console.log('Analyzing player recommendations based on upcoming fixtures...\n');
        
        const recommendations = {};
        
        timeHorizons.forEach(weeks => {
            console.log(`Analyzing ${weeks} week horizon...`);
            recommendations[weeks] = this.analyzeTimeHorizon(weeks);
        });
        
        return recommendations;
    }

    /**
     * Analyze players for a specific time horizon
     */
    analyzeTimeHorizon(gameweeksAhead) {
        const playerAnalysis = this.allPlayersData
            .filter(player => player.status === 'a' && player.minutes > 200) // Available and played some minutes
            .map(player => {
                const fixtures = this.getPlayerUpcomingFixtures(player.id, gameweeksAhead);
                const totalVulnerability = fixtures.reduce((sum, fixture) => sum + fixture.vulnerabilityScore, 0);
                const avgVulnerability = fixtures.length > 0 ? totalVulnerability / fixtures.length : 0;
                
                return {
                    id: player.id,
                    name: `${player.first_name} ${player.second_name}`,
                    webName: player.web_name,
                    team: this.bootstrapData.teams.find(t => t.id === player.team)?.name || 'Unknown',
                    position: this.getPositionName(player.element_type),
                    positionId: player.element_type,
                    cost: player.now_cost / 10,
                    totalPoints: player.total_points,
                    form: parseFloat(player.form),
                    fixturesCount: fixtures.length,
                    totalVulnerabilityScore: totalVulnerability.toFixed(2),
                    avgVulnerabilityScore: avgVulnerability.toFixed(2),
                    fixtures: fixtures,
                    selectedBy: parseFloat(player.selected_by_percent)
                };
            })
            .filter(player => player.fixturesCount > 0); // Only players with fixtures

        // Group by position and sort
        const positions = {
            'Goalkeeper': playerAnalysis.filter(p => p.positionId === 1),
            'Defender': playerAnalysis.filter(p => p.positionId === 2), 
            'Midfielder': playerAnalysis.filter(p => p.positionId === 3),
            'Forward': playerAnalysis.filter(p => p.positionId === 4)
        };

        // Sort each position by total vulnerability score (descending)
        Object.keys(positions).forEach(position => {
            positions[position].sort((a, b) => {
                // Primary sort: total vulnerability score
                const scoreDiff = parseFloat(b.totalVulnerabilityScore) - parseFloat(a.totalVulnerabilityScore);
                if (Math.abs(scoreDiff) > 0.5) return scoreDiff;
                
                // Secondary sort: form
                return parseFloat(b.form) - parseFloat(a.form);
            });
        });

        return positions;
    }

    /**
     * Helper method to get position name
     */
    getPositionName(elementType) {
        const positions = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' };
        return positions[elementType] || 'Unknown';
    }

    /**
     * Display player recommendations
     */
    displayRecommendations(recommendations) {
        console.log('='.repeat(80));
        console.log('FPL PLAYER RECOMMENDATIONS BASED ON FIXTURE DIFFICULTY');
        console.log('='.repeat(80));

        Object.keys(recommendations).forEach(weeks => {
            console.log(`\n📅 ${weeks} WEEK HORIZON:`);
            console.log('='.repeat(50));

            const positions = recommendations[weeks];
            
            Object.keys(positions).forEach(position => {
                const players = positions[position];
                if (players.length === 0) return;

                console.log(`\n🏆 TOP ${position.toUpperCase()}S:`);
                console.log('-'.repeat(40));
                
                // Show top 5 players for each position
                players.slice(0, 5).forEach((player, index) => {
                    const rank = index + 1;
                    console.log(`${rank}. ${player.webName.padEnd(18)} | ${player.team.padEnd(12)} | £${player.cost.toFixed(1)}`);
                    
                    // Show fixtures
                    console.log(`   Fixtures: ${player.fixtures.map(f => f.opponent).join(', ')}`);
                    console.log(`   Form: ${player.form} | Ownership: ${player.selectedBy}%\n`);
                });
            });
        });

        // Summary recommendations
        console.log('='.repeat(80));
        console.log('SUMMARY RECOMMENDATIONS');
        console.log('='.repeat(80));
        
        Object.keys(recommendations).forEach(weeks => {
            console.log(`\n${weeks} WEEK TARGETS:`);
            
            Object.keys(recommendations[weeks]).forEach(position => {
                const topPlayer = recommendations[weeks][position][0];
                if (topPlayer) {
                    console.log(`${position}: ${topPlayer.webName} (${topPlayer.team})`);
                }
            });
        });

        console.log('\n💡 Higher vulnerability scores indicate better fixture runs!');
        console.log('='.repeat(80));
    }
}

/**
 * Main execution function
 */
async function runTeamDefenseAnalysis() {
    try {
        const analyzer = new TeamDefenseAnalyzer();
        await analyzer.initialize();
        
        const results = await analyzer.analyzeTeamDefense();
        analyzer.displayResults(results);
        
        return results;
        
    } catch (error) {
        console.error('Team defense analysis failed:', error.message);
        throw error;
    }
}

/**
 * Run complete analysis including player recommendations
 */
async function runCompleteAnalysis() {
    try {
        // First run the team defense analysis
        const analyzer = new TeamDefenseAnalyzer();
        await analyzer.initialize();
        const defenseResults = await analyzer.analyzeTeamDefense();
        analyzer.displayResults(defenseResults);
        
        // Then run player recommendations
        console.log('\n' + '='.repeat(80));
        console.log('GENERATING PLAYER RECOMMENDATIONS...');
        console.log('='.repeat(80));
        
        const playerAnalyzer = new PlayerFixtureAnalyzer(defenseResults);
        await playerAnalyzer.initialize();
        
        const recommendations = playerAnalyzer.getPlayerRecommendations([1, 3, 5]);
        playerAnalyzer.displayRecommendations(recommendations);
        
        return { defenseResults, recommendations };
        
    } catch (error) {
        console.error('Complete analysis failed:', error.message);
        throw error;
    }
}

// Export the analyzer class and run function
module.exports = {
    TeamDefenseAnalyzer,
    PlayerFixtureAnalyzer,
    runTeamDefenseAnalysis,
    runCompleteAnalysis
};

// Run analysis if this file is executed directly
if (require.main === module) {
    runCompleteAnalysis();
}