export interface ProviderProfile {
    name: string;
    specialty: string;
    yearsExperience?: number;
}

interface PrivilegeTemplates {
    [specialty: string]: string[];
}

const basePrivileges: PrivilegeTemplates = {
    General: [
        "Conduct patient examinations",
        "Order and interpret laboratory tests",
        "Provide discharge planning"
    ],
    Cardiology: [
        "Admit cardiology patients",
        "Interpret EKGs",
        "Perform stress tests"
    ],
    Orthopedics: [
        "Evaluate musculoskeletal injuries",
        "Perform joint injections",
        "Order and interpret imaging"
    ]
};

const advancedPrivileges: PrivilegeTemplates = {
    Cardiology: [
        "Perform cardiac catheterization"
    ],
    Orthopedics: [
        "Perform arthroscopic surgery"
    ]
};

export function composePrivileges(profile: ProviderProfile): string[] {
    const privileges: string[] = [];

    const specialtyPrivileges = basePrivileges[profile.specialty] || basePrivileges["General"];
    privileges.push(...specialtyPrivileges);

    if (profile.yearsExperience && profile.yearsExperience > 10) {
        const advanced = advancedPrivileges[profile.specialty];
        if (advanced) {
            privileges.push(...advanced);
        }
    }

    return privileges;
}
