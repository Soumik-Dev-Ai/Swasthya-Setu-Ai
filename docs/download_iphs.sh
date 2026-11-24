#!/bin/bash
# Downloads all 4 IPHS 2022 guideline PDFs into docs_raw/
# Usage: bash download_iphs.sh   (run from your project root)

mkdir -p docs_raw
cd docs_raw

curl -L -o iphs_sub_centre.pdf \
  "https://nhsrcindia.org/sites/default/files/SHC-HWC%20%26%20UHWC%20IPHS%202022%20Guidelines%20pdf.pdf"

curl -L -o iphs_phc.pdf \
  "https://nhsrcindia.org/sites/default/files/PHC%20IPHS_2022_Guideline_pdf.pdf"

curl -L -o iphs_chc.pdf \
  "https://nhsrcindia.org/sites/default/files/CHC%20IPHS%202022%20Guidelines%20pdf.pdf"

curl -L -o iphs_sdh_dh.pdf \
  "https://nhm.gov.in/images/pdf/guidelines/iphs/iphs-revised-guidlines-2022/01-SDH_DH_IPHS_Guidelines-2022.pdf"

# ICMR: only these two are actually relevant to the tracked disease set (chronic-follow-up flag, FR-11) —
# icmr.gov.in/guidelines itself is an index page of dozens of unrelated categories, not a document.
curl -L -o icmr_type1_diabetes.pdf \
  "https://www.icmr.gov.in/icmrobject/custom_data/pdf/resource-guidelines/ICMR_Guidelines_for_Management_of_Type_1_Diabetes.pdf"

curl -L -o icmr_type2_diabetes.pdf \
  "https://www.icmr.gov.in/icmrobject/custom_data/pdf/resource-guidelines/ICMR_GuidelinesType2diabetes2018_0.pdf"

echo "Done. Files in docs_raw/:"
ls -la
