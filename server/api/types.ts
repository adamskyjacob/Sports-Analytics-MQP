type BMLArray<T, N extends number, Current extends T[]> = Current['length'] extends N ? [...Current, ...T[]] : BMLArray<T, N, [...Current, T]>;
export type MLArray<T, N extends number> = BMLArray<T, N, []>;

type RoundEntry = {
    round: string,
    stats: {
        war: number,
        uzr: number,
        ops: number,
        fldPct: number,
        eraMinus: number,
        fieldingInnings: number,
        plateAppearances: number,
        inningsPitched: number,
        gamesPlayedHitting: number,
        gamesPlayedPitching: number,
        gamesPlayedFielding: number,
    }
};

type StatGroup = {
    sum: number,
    plr_count: number
}

type PerPickStat = { pick: string, totalValue: number };

type MonetaryValue = { _id: string, round: string, totalValue: number, playerCount: number }

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
            plr_count: 0
        }
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
}

type PlayerDraftInfo = {
    PLAYER_ID: number,
    FIRST_NAME: string,
    LAST_NAME: string,
    DRAFT_YEAR: number,
    DRAFT_ROUND: string,
    DRAFT_POSITION: number,
    DEBUT_YEAR: number,
    INTERNATIONAL: boolean
}

type SQLBasic = "TINYBLOB" | "TINYTEXT" | "MEDIUMTEXT" | "MEDIUMBLOB" | "LONGTEXT" | "LONGBLOB" | "BOOL" | "BOOLEAN" | "DATE" | "YEAR";

type SQLEnum = SQLType & {
    vals: string[],
    type: "ENUM"
}

type SQLBasicType = {
    name: string,
    type: SQLBasic,
    nullable: "NULL" | "NOT NULL"
}

type SQLType = {
    name: string,
    type: string,
    nullable: "NULL" | "NOT NULL"
}

type SQLVarType = SQLType & {
    size: number
}

type SQLTypeArray = (SQLType | SQLVarType | SQLBasicType | SQLEnum)[];

type PlayerInformation = {
    _id: number,
    firstName: string,
    lastName: string,
    birthDate: string,
    birthCountry: string,
    height: string,
    weight: number,
    draftYear: number,
    mlbDebutDate: number,
    lastPlayedDate: number,
    batSide: "L" | "R" | "S",
    pitchHand: "L" | "R" | "S"
}

type StatisticsPlayer = {
    id: number,
    year: number,
    position: string,
    stats: any[]
}

type DraftPlayer = {
    id: number,
    draftYear: number,
    draftRound: string,
    draftPosition: number,
    isPass: boolean,
    pickValue: number,
    signingBonus: number,
    school: "HS" | "UNI" | "N/A"
}

export type {
    PlayerDraftInfo, SQLBasic, SQLEnum, SQLBasicType, SQLType, SQLVarType, SQLTypeArray, PlayerInformation, StatisticsPlayer, DraftPlayer, StatGroup, RoundEntry, MonetaryValue, PerPickStat
}

export { Timer, SectionalValue }