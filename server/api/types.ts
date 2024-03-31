type RoundEntry = {
    round: string;
    stats: {
        war: number;
        uzr: number;
        ops: number;
        fldPct: number;
        eraMinus: number;
        fieldingInnings: number;
        plateAppearances: number;
        inningsPitched: number;
        gamesPlayedHitting: number;
        gamesPlayedPitching: number;
        gamesPlayedFielding: number;
    };
};

type StatGroup = {
    sum: number;
    plr_count: number;
};

type PerPickStat = {
    pick: string;
    totalValue: number;
};

type MonetaryValue = {
    _id: string;
    round: string;
    totalValue: number;
    playerCount: number;
};

class SectionalValue {
    war: StatGroup;
    uzr: StatGroup;
    ops: StatGroup;
    fldPct: StatGroup;
    eraMinus: StatGroup;
    fieldingInnings: StatGroup;
    plateAppearances: StatGroup;
    inningsPitched: StatGroup;
    gamesPlayedHitting: StatGroup;
    gamesPlayedFielding: StatGroup;
    gamesPlayedPitching: StatGroup;

    constructor() {
        this.war = SectionalValue.newStatGroup();
        this.uzr = SectionalValue.newStatGroup();
        this.ops = SectionalValue.newStatGroup();
        this.fldPct = SectionalValue.newStatGroup();
        this.eraMinus = SectionalValue.newStatGroup();
        this.fieldingInnings = SectionalValue.newStatGroup();
        this.inningsPitched = SectionalValue.newStatGroup();
        this.plateAppearances = SectionalValue.newStatGroup();
        this.gamesPlayedHitting = SectionalValue.newStatGroup();
        this.gamesPlayedFielding = SectionalValue.newStatGroup();
        this.gamesPlayedPitching = SectionalValue.newStatGroup();
    }

    public static newStatGroup(): StatGroup {
        return {
            sum: 0,
            plr_count: 0,
        };
    }
}

class Timer {
    start: number;

    constructor() {
        this.start = Date.now();
    }

    public getElapsedTime(stringFormat: boolean): string | number {
        const elapsed = Date.now() - this.start;
        if (stringFormat) {
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            return formattedTime;
        } else {
            return elapsed;
        }
    }

    public print() {
        console.log(`======== FINISHED IN ${this.getElapsedTime(true)} ========`);
    }

    public printTime() {
        console.log(`======== FINISHED DATA COLLECTION AT ${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()} ========`);
    }
}

type PlayerDraftInfo = {
    PLAYER_ID: number;
    FIRST_NAME: string;
    LAST_NAME: string;
    DRAFT_YEAR: number;
    DRAFT_ROUND: string;
    DRAFT_POSITION: number;
    DEBUT_YEAR: number;
    INTERNATIONAL: boolean;
};

type PlayerInformation = {
    draftYear: number;
    draftRound: string;
    pickNumber: number;
    mlbDebutDate: number;
    lastPlayedDate: number;
};

type StatisticsPlayer = {
    id: number;
    year: number;
    position: string;
    stats: any[];
};

type DraftPlayer = {
    id: number;
    draftYear: number;
    pickNumber: string;
    draftRound: string;
    isPass: boolean;
    signingBonus: number;
    pickValue: number;
};

type HittingPlayer = {
    id: number;
    seasonYear: number;
    war: number;
    ops: string;
    plateAppearances: number;
    gamesPlayed: number;
};

type FieldingPlayer = {
    id: number;
    seasonYear: number;
    position: number;
    uzr: number;
    fldPct: string;
    innings: string;
    gamesPlayed: number;
};

type PitchingPlayer = {
    id: number;
    seasonYear: number;
    eraMinus: number;
    inningsPitched: string;
    gamesPlayed: number;
};

type Stats = {
    war: number;
    uzr: number;
    ops: number;
    fldPct: number;
    eraMinus: number;
    inningsPitched: number;
    plateAppearances: number;
    fieldingInnings: number;
    gamesPlayedHitting: number;
    gamesPlayedPitching: number;
    gamesPlayedFielding: number;
};

export type {
    PlayerDraftInfo,
    PlayerInformation,
    StatisticsPlayer,
    DraftPlayer,
    StatGroup,
    RoundEntry,
    MonetaryValue,
    PerPickStat,
    Stats,
    PitchingPlayer,
    FieldingPlayer,
    HittingPlayer
};

export { Timer, SectionalValue };
