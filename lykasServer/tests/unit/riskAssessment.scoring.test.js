const mongoose = require("mongoose");
const RiskAssessment = require("../../src/models/RiskAssessment");

function makeAssessment(scores) {
  return new RiskAssessment({
    application: new mongoose.Types.ObjectId(),
    applicant: new mongoose.Types.ObjectId(),
    pet: new mongoose.Types.ObjectId(),
    assessedBy: new mongoose.Types.ObjectId(),
    scores,
  });
}

describe("RiskAssessment scoring (pre-save hook, exercised via real save())", () => {
  it("sums the six dimension scores into totalScore and marks Low at max scores", async () => {
    const doc = await makeAssessment({
      housingStability: 5,
      financialReadiness: 5,
      petExperience: 5,
      lifestyleMatch: 5,
      familyCommitment: 5,
      knowledgeOfPet: 5,
    }).save();

    expect(doc.totalScore).toBe(30);
    expect(doc.riskLevel).toBe("Low");
  });

  it("classifies riskLevel as Low at exactly the 24 threshold", async () => {
    const doc = await makeAssessment({
      housingStability: 4,
      financialReadiness: 4,
      petExperience: 4,
      lifestyleMatch: 4,
      familyCommitment: 4,
      knowledgeOfPet: 4,
    }).save();

    expect(doc.totalScore).toBe(24);
    expect(doc.riskLevel).toBe("Low");
  });

  it("classifies riskLevel as Medium at exactly the 15 threshold", async () => {
    const doc = await makeAssessment({
      housingStability: 3,
      financialReadiness: 3,
      petExperience: 3,
      lifestyleMatch: 2,
      familyCommitment: 2,
      knowledgeOfPet: 2,
    }).save();

    expect(doc.totalScore).toBe(15);
    expect(doc.riskLevel).toBe("Medium");
  });

  it("classifies riskLevel as Medium just below the Low threshold (23)", async () => {
    const doc = await makeAssessment({
      housingStability: 4,
      financialReadiness: 4,
      petExperience: 4,
      lifestyleMatch: 4,
      familyCommitment: 4,
      knowledgeOfPet: 3,
    }).save();

    expect(doc.totalScore).toBe(23);
    expect(doc.riskLevel).toBe("Medium");
  });

  it("classifies riskLevel as High below 15", async () => {
    const doc = await makeAssessment({
      housingStability: 1,
      financialReadiness: 2,
      petExperience: 1,
      lifestyleMatch: 2,
      familyCommitment: 1,
      knowledgeOfPet: 1,
    }).save();

    expect(doc.totalScore).toBe(8);
    expect(doc.riskLevel).toBe("High");
  });

  it("rejects scores outside the 1-5 range at the schema level", async () => {
    const doc = makeAssessment({
      housingStability: 6,
      financialReadiness: 3,
      petExperience: 3,
      lifestyleMatch: 3,
      familyCommitment: 3,
      knowledgeOfPet: 3,
    });

    await expect(doc.save()).rejects.toThrow();
  });

  it("ignores a client-supplied totalScore/riskLevel and always recomputes server-side", async () => {
    const doc = makeAssessment({
      housingStability: 1,
      financialReadiness: 1,
      petExperience: 1,
      lifestyleMatch: 1,
      familyCommitment: 1,
      knowledgeOfPet: 1,
    });
    doc.totalScore = 999;
    doc.riskLevel = "Low";

    await doc.save();

    expect(doc.totalScore).toBe(6);
    expect(doc.riskLevel).toBe("High");
  });
});
