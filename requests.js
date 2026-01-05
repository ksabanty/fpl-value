// Using fetch API (Node.js 18+ or with node-fetch package for older versions)
async function getAllPlayerIds() {
    try {
        console.log('Fetching player data from FPL API...');
        
        // Make request to bootstrap-static endpoint
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        // print a small sample of the data structure in a formatted way
        // console.log(JSON.stringify(data.elements.slice(0, 1), null, 2));
        
        // Extract player IDs from the elements array
        const playerIds = data.elements.map(player => player.id);
        
        console.log(`Successfully retrieved ${playerIds.length} player IDs`);
        // console.log('First 10 player IDs:', playerIds.slice(0, 10));
        
        return playerIds;
        
    } catch (error) {
        console.error('Error fetching player IDs:', error.message);
        throw error;
    }
}

// Fetch detailed data for a specific player
async function getPlayerData(playerId) {
    try {
        console.log(`Fetching detailed data for player ID: ${playerId}...`);
        
        // Make request to player-specific endpoint
        const response = await fetch(`https://fantasy.premierleague.com/api/element-summary/${playerId}/`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(`Successfully retrieved data for player ${playerId}`);
        // log data in a formatted way
        // console.log(JSON.stringify(data.history, null, 2));
        
        // Display sample of the data structure
        // console.log('\n--- Player Data Structure ---');
        // console.log('History (last few gameweeks):', data.history?.length || 0, 'entries');
        // console.log('History Past (previous seasons):', data.history_past?.length || 0, 'entries');
        // console.log('Fixtures (upcoming games):', data.fixtures?.length || 0, 'entries');
        
        // Show a sample history entry if available
        // if (data.history && data.history.length > 0) {
        //     console.log('\n--- Sample Gameweek Data (most recent) ---');
        //     const recentGame = data.history[data.history.length - 1];
        //     console.log('Gameweek:', recentGame.round);
        //     console.log('Points:', recentGame.total_points);
        //     console.log('Minutes played:', recentGame.minutes);
        //     console.log('Goals scored:', recentGame.goals_scored);
        //     console.log('Assists:', recentGame.assists);
        //     console.log('Clean sheets:', recentGame.clean_sheets);
        //     console.log('Yellow cards:', recentGame.yellow_cards);
        //     console.log('Red cards:', recentGame.red_cards);
        //     console.log('Saves:', recentGame.saves);
            // console.log('Bonus points:', recentGame.bonus);
        // }
        
        // Show upcoming fixture if available
        // if (data.fixtures && data.fixtures.length > 0) {
        //     console.log('\n--- Next Fixture ---');
        //     const nextFixture = data.fixtures[0];
        //     console.log('Gameweek:', nextFixture.event);
        //     console.log('Opponent team ID:', nextFixture.team_a === nextFixture.team_h ? 'Away' : 'Home');
        //     console.log('Is home game:', nextFixture.is_home);
        //     console.log('Difficulty:', nextFixture.difficulty);
        // }
        
        return data;
        
    } catch (error) {
        console.error(`Error fetching data for player ${playerId}:`, error.message);
        throw error;
    }
}

// Fetch all Premier League fixtures for the season
async function getAllFixtures() {
    try {
        console.log('Fetching all Premier League fixtures...');
        
        // Make request to fixtures endpoint
        const response = await fetch('https://fantasy.premierleague.com/api/fixtures/');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const fixtures = await response.json();
        
        console.log(`Successfully retrieved ${fixtures.length} fixtures`);
        
        return fixtures;
        
    } catch (error) {
        console.error('Error fetching fixtures:', error.message);
        throw error;
    }
}

// Example usage and testing
async function main() {
    try {
        // Using fetch (preferred method for Node.js 18+)
        const playerIds = await getAllPlayerIds();
        
        // Store in array as requested
        // console.log(`\nPlayer IDs array (${playerIds.length} total):`, playerIds);
        
        // Demonstrate player-specific data with a sample player
        if (playerIds.length > 0) {
            console.log('\n=== FETCHING SAMPLE PLAYER DATA ===');
            // Use the first player ID as a sample
            const samplePlayerId = playerIds[0];
            const playerData = await getPlayerData(samplePlayerId);
            // console.log(`\nSample Player Data for ID ${samplePlayerId}:`, JSON.stringify(playerData, null, 2));
        }
        
        // Demonstrate fixtures data
        console.log('\n=== FETCHING ALL PREMIER LEAGUE FIXTURES ===');
        const fixtures = await getAllFixtures();
        return { playerIds, fixtures };
        
    } catch (error) {
        console.log('\nFetch failed...');
    }
}

// Export functions for use in other modules
module.exports = {
    getAllPlayerIds,
    getPlayerData,
    getAllFixtures,
    main
};

// Run the main function if this file is executed directly
if (require.main === module) {
    main();
}
