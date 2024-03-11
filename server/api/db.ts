
import { DraftPlayer, Stats, Timer } from './types';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { connectionUrl } from './credentials';
import readline from 'readline';
import { calculateNumericInning, colorString, draftPlayers, onlyUnique, sabermetricsURL, splitArray, yearlyPlayers } from './util';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getInput(): Promise<string> {
    return new Promise((resolve) => {
        rl.question('Do you want to clear all collections before data entry?\n', (answer) => {
            resolve(answer.trim().toLowerCase());
        });
    });
}

const client = new MongoClient(connectionUrl, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const startYear = 2000;
const endYear = 2023;

const mongodb = client.db("MLB");

const playerInfoCollection = mongodb.collection("Player_Info");
const draftCollection = mongodb.collection("Draft_Info");

const fieldingCollection = mongodb.collection("Fielding");
const hittingCollection = mongodb.collection("Hitting");
const pitchingCollection = mongodb.collection("Pitching");

const perPickStatisticsPercentageCollection = mongodb.collection("Per_Pick_Statistics_Percentage");
const perRoundStatisticsPercentageCollection = mongodb.collection("Per_Round_Statistics_Percentage");
const perPickPlayerValuePercentageCollection = mongodb.collection("Per_Pick_Player_Value_Percentage");
const perRoundPlayerValuePercentageCollection = mongodb.collection("Per_Round_Player_Value_Percentage");

export async function tryInitializeDatabase() {
    let clearDB;
    while (clearDB === undefined || clearDB === null) {
        const input = await getInput();
        if (!["yes", "no", "y", "n"].includes(input)) {
            console.log('Invalid response.');
            continue;
        }

        clearDB = ["yes", "y"].includes(input) ? true : false;
    }
    rl.close();

    const timer = new Timer();
    await client.connect();
    if (clearDB) {
        (await mongodb.collections()).forEach(async c => {
            if (c.dbName === "MLB" && !["Hitting", "Pitching", "Fielding", "Draft_Info", "Player_Info"].includes(c.collectionName)) {
                await c.deleteMany();
            }
        });
    }

    await getDraftInfo();
    await getPlayerInformation();
    await getPlayerStatistics();
    await getStatisticPercentages();
    await getPlayerValue();
    timer.print();
}

function emptyStats() {
    return {
        war: 0,
        uzr: 0,
        ops: 0,
        fldPct: 0,
        eraMinus: 0,
        inningsPitched: 0,
        plateAppearances: 0,
        fieldingInnings: 0,
        gamesPlayedHitting: 0,
        gamesPlayedPitching: 0,
        gamesPlayedFielding: 0
    }
}

async function getStatisticPercentages() {
    if (await perPickStatisticsPercentageCollection.countDocuments() > 0 || await perRoundStatisticsPercentageCollection.countDocuments() > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting per-pick and per-round statistic percentages..."));

    let mapPick: Map<string, Stats> = new Map();
    let mapRound: Map<string, Stats> = new Map();

    const minArr = await Promise.all([
        Math.abs((await fieldingCollection.find().toArray()).sort((a, b) => a.uzr - b.uzr)[0]['uzr']),
        Math.abs((await hittingCollection.find().toArray()).sort((a, b) => a.war - b.war)[0]['war']),
        Math.abs((await pitchingCollection.find().toArray()).sort((a, b) => a.eraMinus - b.eraMinus)[0]['eraMinus'])
    ]);

    const minimums: { uzr: number, war: number, eraMinus: number } = {
        uzr: minArr[0],
        war: minArr[1],
        eraMinus: minArr[2],
    }

    const players = await playerInfoCollection.find().toArray();

    for (let player of players) {
        const fielding = await fieldingCollection.find({ id: player._id }).toArray();
        const hitting = await hittingCollection.find({ id: player._id }).toArray();
        const pitching = await pitchingCollection.find({ id: player._id }).toArray();

        let round = String(player.draftRound);
        let roundNum = Number(round);
        if (["C", "C-1", "C-A", "C-2", "C-B", "SUP", "1C", "2C", "4C"].includes(round) || (!isNaN(roundNum) && roundNum > 20)) {
            continue;
        }

        if (round === "CB-A") {
            round = "1";
        } else if (round === "CB-B") {
            round = "2";
        }

        let newValuePick = mapPick.get(String(player.pickNumber)) ?? emptyStats();
        let newValueRound = mapRound.get(round) ?? emptyStats();
        
        for (let obj of fielding) {
            newValuePick.fldPct += Number(obj.fldPct ?? 0);
            newValuePick.uzr += Number(obj.uzr) + Number(minimums.uzr);
            newValuePick.fieldingInnings += calculateNumericInning(Number(obj.innings));
            newValuePick.gamesPlayedFielding += Number(obj.gamesPlayed);

            newValueRound.fldPct += Number(obj.fldPct ?? 0);
            newValueRound.uzr += Number(obj.uzr) + Number(minimums.uzr);
            newValueRound.fieldingInnings += calculateNumericInning(Number(obj.innings));
            newValueRound.gamesPlayedFielding += Number(obj.gamesPlayed);
        }

        for (let obj of hitting) {
            newValuePick.war += Number(obj.war) + Number(minimums.war);
            newValuePick.plateAppearances += Number(obj.plateAppearances);
            newValuePick.gamesPlayedHitting += Number(obj.gamesPlayed);
            newValuePick.ops += Number(obj.ops);

            newValueRound.war += Number(obj.war) + Number(minimums.war);
            newValueRound.plateAppearances += Number(obj.plateAppearances);
            newValueRound.gamesPlayedHitting += Number(obj.gamesPlayed);
            newValueRound.ops += Number(obj.ops);
        }

        for (let obj of pitching) {
            newValuePick.gamesPlayedPitching += Number(obj.gamesPlayed);
            newValuePick.inningsPitched += calculateNumericInning(Number(obj.inningsPitched));
            newValuePick.eraMinus += Number(obj.eraMinus) + Number(minimums.eraMinus);

            newValueRound.gamesPlayedPitching += Number(obj.gamesPlayed);
            newValueRound.inningsPitched += calculateNumericInning(Number(obj.inningsPitched));
            newValueRound.eraMinus += Number(obj.eraMinus) + Number(minimums.eraMinus);
        }

        mapPick.set(String(player.pickNumber), newValuePick);
        mapRound.set(round, newValueRound);
    }

    let [warTotal, uzrTotal, opsTotal, fldPctTotal, eraMinusTotal, inningsPitchedTotal, plateAppearancesTotal, fieldingInningsTotal, gamesPlayedHittingTotal, gamesPlayedPitchingTotal, gamesPlayedFieldingTotal] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (const value of mapPick.values()) {
        warTotal += value.war;
        uzrTotal += value.uzr;
        opsTotal += value.ops;
        fldPctTotal += value.fldPct;
        eraMinusTotal += value.eraMinus;
        inningsPitchedTotal += value.inningsPitched;
        plateAppearancesTotal += value.plateAppearances;
        fieldingInningsTotal += value.fieldingInnings;
        gamesPlayedHittingTotal += value.gamesPlayedHitting;
        gamesPlayedPitchingTotal += value.gamesPlayedPitching;
        gamesPlayedFieldingTotal += value.gamesPlayedFielding;
    }
    
    const perPickTable = [], perRoundTable = [];
    for (const [key, value] of mapPick.entries()) {
        perPickTable.push({
            pick: key,
            war: value.war / warTotal,
            uzr: value.uzr / uzrTotal,
            ops: value.ops / opsTotal,
            fldPct: value.fldPct / fldPctTotal,
            eraMinus: value.eraMinus / eraMinusTotal,
            inningsPitched: value.inningsPitched / inningsPitchedTotal,
            plateAppearances: value.plateAppearances / plateAppearancesTotal,
            fieldingInnings: value.fieldingInnings / fieldingInningsTotal,
            gamesPlayedHitting: value.gamesPlayedHitting / gamesPlayedHittingTotal,
            gamesPlayedPitching: value.gamesPlayedPitching / gamesPlayedPitchingTotal,
            gamesPlayedFielding: value.gamesPlayedFielding / gamesPlayedFieldingTotal,
        });
    }

    for (const [key, value] of mapRound.entries()) {
        perRoundTable.push({
            pick: key,
            war: value.war / warTotal,
            uzr: value.uzr / uzrTotal,
            ops: value.ops / opsTotal,
            fldPct: value.fldPct / fldPctTotal,
            eraMinus: value.eraMinus / eraMinusTotal,
            inningsPitched: value.inningsPitched / inningsPitchedTotal,
            plateAppearances: value.plateAppearances / plateAppearancesTotal,
            fieldingInnings: value.fieldingInnings / fieldingInningsTotal,
            gamesPlayedHitting: value.gamesPlayedHitting / gamesPlayedHittingTotal,
            gamesPlayedPitching: value.gamesPlayedPitching / gamesPlayedPitchingTotal,
            gamesPlayedFielding: value.gamesPlayedFielding / gamesPlayedFieldingTotal,
        });
    }
    await perPickStatisticsPercentageCollection.insertMany(perPickTable);
    await perRoundStatisticsPercentageCollection.insertMany(perRoundTable);
}

async function getPlayerValue() {
    if (await perPickPlayerValuePercentageCollection.countDocuments() > 0 || await perRoundPlayerValuePercentageCollection.countDocuments() > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting per-pick player value..."));
    let mapPick = new Map<string, number>();
    let mapRound = new Map<string, number>();
    let totalValue = 0;

    const data = await draftCollection.find({ isPass: false }).toArray();

    for (var player of data) {
        if (!player) {
            continue;
        }

        const pick = player.pickNumber;
        let round = player.draftRound;
        let roundNum = Number(round);
        if (["C", "C-1", "C-A", "C-2", "C-B", "SUP", "1C", "2C", "4C"].includes(round) || (!isNaN(roundNum) && roundNum > 20)) {
            continue;
        }

        if (round === "CB-A") {
            round = "1";
        } else if (round === "CB-B") {
            round = "2";
        }

        const signingBonusNum = Number(player["signingBonus"] ?? 0);
        const pickValueNum = Number(player["pickValue"] ?? 0);

        let valueArray: number[] = [];
        if (!isNaN(signingBonusNum)) {
            valueArray.push(signingBonusNum);
        }
        if (!isNaN(pickValueNum)) {
            valueArray.push(pickValueNum);
        }

        let value = Math.max(...valueArray);
        totalValue += value;

        if (mapPick.get(pick)) {
            mapPick.set(pick, mapPick.get(pick) + value)
        } else {
            mapPick.set(pick, value)
        }

        if (mapRound.get(round)) {
            mapRound.set(round, mapRound.get(round) + value)
        } else {
            mapRound.set(round, value)
        }
    }

    let perPickPlayerValueTable = [];
    let perRoundPlayerValueTable = [];
    for (let [key, val] of mapPick.entries()) {
        perPickPlayerValueTable.push({ pick: key, pct: val / totalValue });
    }
    for (let [key, val] of mapRound.entries()) {
        perRoundPlayerValueTable.push({ pick: key, pct: val / totalValue });
    }

    await perPickPlayerValuePercentageCollection.insertMany(perPickPlayerValueTable);
    await perRoundPlayerValuePercentageCollection.insertMany(perRoundPlayerValueTable);
}

async function getDraftInfo(): Promise<void> {
    const draftInfoCount = await draftCollection.countDocuments();
    let draftInfoTable = [];
    if (draftInfoCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting draft information..."));
    for (let year = startYear - 25; year < endYear; year++) {
        let raw = await fetch(draftPlayers(year));
        let draftinfo = await raw.json();
        for (var round of draftinfo['drafts']['rounds']) {
            let picks = round["picks"];
            for (var player of picks) {
                if (player['person']) {
                    if (player['isPass'] == true) {
                        continue;
                    }
                    
                    draftInfoTable.push({
                        id: player['person']['id'] ?? 0,
                        draftYear: year,
                        pickNumber: player['pickNumber'] ?? 0,
                        draftRound: player['pickRound'] ?? 0,
                        isPass: player['isPass'] ?? false,
                        signingBonus: player['signingBonus'] ?? 0,
                        pickValue: player['pickValue'] ?? 0,
                    } as DraftPlayer);
                }
            }
        }
    }

    await draftCollection.insertMany(draftInfoTable);
}

async function getPlayerInformation(): Promise<void> {
    const playerInfoCount = await playerInfoCollection.countDocuments();
    let playerInfoTable = [], includedIds = [];

    if (playerInfoCount > 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data."));
        return;
    }

    console.log(colorString("G", "Getting player information from MLB API..."));
    for (let year = startYear; year < endYear; year++) {
        let res = await fetch(yearlyPlayers(year));
        let json = await res.json();

        for (var player of json['people']) {
            let debut = Number(player['mlbDebutDate']?.substring(0, 4));
            if (Number.isNaN(debut) || includedIds.includes(player['id'])) {
                continue;
            }

            const playerDraft = await draftCollection.findOne({ id: Number(player['id']) });
            if (debut >= startYear) {
                includedIds.push(player['id'])
                if (playerDraft) {
                    playerInfoTable.push({
                        _id: player['id'],
                        draftYear: player['draftYear'] ?? 0,
                        draftRound: playerDraft['draftRound'],
                        pickNumber: playerDraft['pickNumber'],
                        mlbDebutDate: Number((player['mlbDebutDate'] ?? "00000").substring(0, 4)),
                        lastPlayedDate: Number((player['lastPlayedDate'] ?? "00000").substring(0, 4) ?? 10000)
                    });
                } else {
                    playerInfoTable.push({
                        _id: player['id'],
                        draftYear: 0,
                        draftRound: "intl",
                        pickNumber: "intl",
                        mlbDebutDate: Number((player['mlbDebutDate'] ?? "00000").substring(0, 4)),
                        lastPlayedDate: Number((player['lastPlayedDate'] ?? "00000").substring(0, 4) ?? 10000)
                    });
                }
            }
        }
    }

    await playerInfoCollection.insertMany(playerInfoTable);
}

async function getPlayerStatistics(): Promise<void> {
    let hittingTable = [], pitchingTable = [], fieldingTable = [];
    const [fieldingCount, hittingCount, pitchingCount] = await Promise.all([
        fieldingCollection.countDocuments(),
        hittingCollection.countDocuments(),
        pitchingCollection.countDocuments()
    ]);

    if (fieldingCount != 0 && pitchingCount != 0 && hittingCount != 0) {
        console.log(colorString("R", "There are already data entries in this collection. Clear collection to re-enter data"));
        return;
    }

    console.log(colorString("G", "Getting player statistics..."));
    for (let year = startYear; year < endYear; year++) {
        console.log(year);
        const rows = (await playerInfoCollection.find().toArray()).map(d => Number(d._id));
        const splitArr = splitArray(rows, 640);

        for (let split of splitArr) {
            const raw = await fetch(sabermetricsURL(split, year));
            const json = await raw.json();
            if (!json['people']) {
                continue;
            }

            for (let player of json['people']) {
                const stats = player['stats'];
                const statTypes = stats?.map(stat => stat.type.displayName + stat.group.displayName);
                let fielding = stats?.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "fielding"), positions;

                if (!stats) {
                    continue;
                }

                if (fielding && fielding.length > 0) {
                    positions = fielding[0].splits.map(split => split.position.abbreviation).filter(onlyUnique);
                }

                const saberhitting = stats.filter(stat => stat.type.displayName == "sabermetrics" && stat.group.displayName == "hitting");
                const seasonhitting = stats.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "hitting");
                const saberfielding = stats.filter(stat => stat.type.displayName == "sabermetrics" && stat.group.displayName == "fielding");
                const seasonfielding = stats.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "fielding");
                const saberpitching = stats.filter(stat => stat.type.displayName == "sabermetrics" && stat.group.displayName == "pitching");
                const seasonpitching = stats.filter(stat => stat.type.displayName == "season" && stat.group.displayName == "pitching");

                if ((statTypes.includes("seasonhitting") || statTypes.includes("sabermetricshitting")) && hittingCount == 0) {
                    hittingTable.push({
                        _id: `${player.id}-${year}`,
                        id: player.id,
                        seasonYear: year,
                        war: saberhitting[0]?.splits[0]?.stat?.war ?? 0,
                        ops: seasonhitting[0]?.splits[0]?.stat?.ops ?? 0,
                        plateAppearances: seasonhitting[0]?.splits[0]?.stat?.plateAppearances ?? 0,
                        gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                    });
                }

                if ((statTypes.includes("seasonfielding") || statTypes.includes("sabermetricsfielding")) && positions && fieldingCount == 0) {
                    for (var position of positions) {
                        fieldingTable.push({
                            _id: `${player.id}-${year}-${position}`,
                            id: player.id,
                            seasonYear: year,
                            position: position,
                            uzr: saberfielding[0]?.splits[0]?.stat?.uzr ?? 0,
                            fldPct: seasonfielding[0]?.splits[0]?.stat?.fielding ?? 0,
                            innings: seasonfielding[0]?.splits[0].stat?.innings ?? 0,
                            gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                        })
                    }
                }

                if (statTypes.includes("sabermetricspitching") && pitchingCount == 0) {
                    pitchingTable.push({
                        _id: `${player.id}-${year}`,
                        id: player.id,
                        seasonYear: year,
                        eraMinus: saberpitching[0]?.splits[0]?.stat?.eraMinus ?? 0,
                        inningsPitched: seasonpitching[0]?.splits[0].stat?.inningsPitched ?? 0,
                        gamesPlayed: seasonhitting[0]?.splits[0]?.stat?.gamesPlayed ?? 0
                    });
                }
            }
        }
    }

    if (hittingCount == 0 && hittingTable.length > 0) {
        await hittingCollection.insertMany(hittingTable);
        console.log(colorString("G", `Added ${hittingTable.length} entries to Hitting collection.`));
    }
    if (pitchingCount == 0 && pitchingTable.length > 0) {
        await pitchingCollection.insertMany(pitchingTable);
        console.log(colorString("G", `Added ${pitchingTable.length} entries to Pitching collection.`));
    }
    if (fieldingCount == 0 && fieldingTable.length > 0) {
        await fieldingCollection.insertMany(fieldingTable);
        console.log(colorString("G", `Added ${fieldingTable.length} entries to Fielding collection.`));
    }
}
