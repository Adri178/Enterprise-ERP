import "reflect-metadata";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { accountingPurposes, purposeAccountTypes } from "@erp/shared";
import { AccountsService } from "../apps/api/dist/accounting/accounts.service.js";
config({ path: new URL("../apps/api/.env", import.meta.url), quiet:true });
if (process.env.NODE_ENV === "production") throw new Error("Development seed only");
const prisma=new PrismaClient(), service=new AccountsService(prisma);
try {
  const actor=await prisma.user.findUniqueOrThrow({where:{email:"admin@enterprise.local"}}), member=await prisma.membership.findUnique({where:{userId_companyId:{userId:actor.id,companyId:"alpha"}},include:{company:true}});
  if (!actor.active || actor.mustChangePassword || !member?.active || member.role!=="ADMIN" || member.company.status!=="ACTIVE") throw new Error("Alpha requires an active operational development ADMIN");
  const groups={};
  for(const type of ["ASSET","LIABILITY","EQUITY","INCOME","EXPENSE"]) {
    const code=`AUTO-${type}`; let row=await prisma.account.findUnique({where:{companyId_code:{companyId:"alpha",code}}});
    if(!row) row=await service.save("alpha",actor.id,{code,name:`${type} Operasional`,type,isGroup:true,parentId:"",status:"ACTIVE"});
    if(!row.isGroup || row.type!==type || row.status!=="ACTIVE") throw new Error(`Existing ${code} requires review; seed preserved it`); groups[type]=row;
  }
  for(const purpose of accountingPurposes) {
    const code=`AUTO-${purpose.replaceAll('_','-')}`, type=purposeAccountTypes[purpose];
    if(!await prisma.account.findUnique({where:{companyId_code:{companyId:"alpha",code}}})) await service.save("alpha",actor.id,{code,name:purpose.replaceAll('_',' '),type,isGroup:false,parentId:groups[type].id,status:"ACTIVE"});
  }
  console.log("Alpha automatic Accounting chart prepared; existing Accounts, policies, transactions and Journals preserved. Activation requires explicit mapping/opening review in the UI.");
} finally {await prisma.$disconnect();}
