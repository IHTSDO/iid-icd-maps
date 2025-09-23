import { HttpClient, HttpEventType } from '@angular/common/http';
import { Component, ChangeDetectorRef } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { MatDialog } from '@angular/material/dialog';
import { LoadingDialogComponent } from '../alerts/loading-dialog.component';
import * as Papa from 'papaparse';

@Component({
  selector: 'app-icd-map',
  templateUrl: './icd-map.component.html',
  styleUrls: ['./icd-map.component.css']
})
/**
 * ICD Map Component
 * 
 * URL Parameters:
 * - ?icd11 - Shows ICD11 mapping functionality
 * - ?icd11=2024 - Uses the extended 2024 format file (der2_iisssccRefset_Icd11MapExtendedMapSnapshot_INT_20241001.txt)
 * - Default (no parameter or other values) - Uses the simple format file (icd11-map-preview.tsv)
 * 
 * Examples:
 * - http://localhost:4200/ - Uses simple format
 * - http://localhost:4200/?icd11 - Uses simple format with ICD11 mapping visible
 * - http://localhost:4200/?icd11=2024 - Uses extended 2024 format with ICD11 mapping visible
 */
export class IcdMapComponent {
  genders: any[] = [
    {code: "248152002", display: "Female"},
    {code: "248153007", display: "Male"},
    {code: "000000000", display: "No information"}
  ];
  gender = this.genders[0];
  age = 35;

  eclReason = '< 138875005 |SNOMED CT Concept (SNOMED RT+CTV3)|';
  selectedReasonSct: any;
  selectedReasonCIE: any[] = [];
  selectedReasonCIE11: any[] = [];
  icd10Data: any[] = [];
  icd11Data: any[] = [];
  icd11MapData: any[] = [];
  icd11MapDataFormat: 'preview' | 'extended' | null = null;
  icd11MapDataVersion: string = 'default'; // Tracks which version is loaded
  term: string = '';

  icd10rules: any[] = [];
  icd10DisplayedColumns: string[] = ['mapGroup', 'mapPriority', 'mapRule', 'mapAdvice', 'mapTarget', 'link', 'result'];
  loadingIcd10 = false;
  icd11rules: any[] = [];
  icd11DisplayedColumns: string[] = ['mapGroup', 'mapPriority', 'mapRule', 'mapAdvice', 'mapTarget', 'result'];
  loadingIcd11 = false;

  chips = [
    { code : '195967001', display : 'Asthma' },
    { code : '421671002', display : 'Pneumonia with AIDS (acquired immunodeficiency syndrome)' },
    { code : '16705321000119109', display : 'Neoplasm of right kidney' },
    { code : '95208000', display : 'Photogenic epilepsy' },
    { code : '8619003', display : 'Infertile' },
    { code : '717934004', display : 'Osteomalacia due to vitamin D deficiency'},
    { code: '39607008', display: 'Lung structure'},
    { code: '82711006', display: 'Infiltrating duct carcinoma '}
    ];

  useICD10CodeSystem = false;
  showICD11Map = false;

  icdOMapDefinition = {
    title: 'ICD-O-3',
    subtitle: 'International Classification of Diseases for Oncology, Third Edition',
    codeSystem: 'http://hl7.org/fhir/sid/icd-o',
    headerClass: 'icdo-header-image'
  }

  constructor(
    private terminologyService: TerminologyService, 
    private http: HttpClient, 
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Read URL parameters first to determine file loading strategy
    const urlParams = new URLSearchParams(window.location.search);
    this.showICD11Map = urlParams.has('icd11');
    
    // Check icd11 parameter value to determine which file to load
    const icd11Param = urlParams.get('icd11');
    
    // Expose component instance for testing
    (window as any)['icdMapComponent'] = this;
    
    this.fetchTsvFile(icd11Param);
  }

  setChip(chip: any) {
    this.term = chip.display;
    this.selectedReasonSct = chip;
    this.updateReason(chip);
  }

  async updateReason(event: any) {
    this.selectedReasonSct = event;
    if (event && event.code) {
      this.matchIcd10(event);
      this.matchIcd11(event);
    }
  }

  matchIcd11(event: any) {
    this.loadingIcd11 = true;
    this.selectedReasonCIE11 = [];
    this.icd11rules = [];
    let filteredData = this.icd11MapData.filter((element: any) => element.referencedComponentId == event.code);
    
    if (!filteredData || !filteredData[0]?.mapTarget) {
      this.selectedReasonCIE11.push([{ code: '', display: 'MAP SOURCE CONCEPT CANNOT BE CLASSIFIED WITH AVAILABLE DATA' }]);
      this.icd11rules = filteredData;
    } else {
      // Filter based on mapRule evaluation (similar to ICD10 logic)
      filteredData = filteredData.filter((element: any) => {
        if (!element.mapRule || element.mapRule === 'TRUE' || element.mapRule === 'OTHERWISE TRUE') {
          return true;
        }
        
        // Basic rule evaluation for gender and age (extend as needed)
        try {
          let localRule = element.mapRule;
          localRule = localRule.replaceAll('IFA 248153007 | Male (finding) |', 'this.gender.code == "248153007"');
          localRule = localRule.replaceAll('IFA 248152002 | Female (finding) |', 'this.gender.code == "248152002"');
          localRule = localRule.replaceAll('IFA 445518008 | Age at onset of clinical finding (observable entity) |', 'this.age');
          localRule = localRule.replaceAll('AND', '&&');
          localRule = localRule.replaceAll('OR', '||');
          localRule = localRule.replaceAll(' years', '');
          
          return eval(localRule);
        } catch (error) {
          return true; // Default to include if rule evaluation fails
        }
      });

      filteredData.sort((a: any, b: any) => {
        if (a.mapGroup < b.mapGroup) {
          return -1;
        }
        if (a.mapGroup > b.mapGroup) {
          return 1;
        }
        if (a.mapPriority < b.mapPriority) {
          return -1;
        }
        if (a.mapPriority > b.mapPriority) {
          return 1;
        }
        if (a.mapTarget < b.mapTarget) {
          return -1;
        }
        if (a.mapTarget > b.mapTarget ) {
          return 1;
        }
        return 0;
      });
      
      this.icd11rules = filteredData;
      let mapGroup = 0;
      let mapTargets: any[] = [];
      
      filteredData.forEach((element: any) => {
        if (element.mapGroup != mapGroup) {
          if (mapTargets.length > 0) {
            this.selectedReasonCIE11.push(mapTargets);
          }
          mapGroup = element.mapGroup;
          mapTargets = [];
        }
        let display = this.icd11Data.find((icd11Element: any) => icd11Element.Code == element.mapTarget);
        if (display) {
          display.Title = display?.Title?.replace(/- /g, '');
          let uri = display["Foundation URI"];
          if (!uri) {
            uri = display["Linearization (release) URI"];
          }
          mapTargets.push({ code: element.mapTarget, display: display.Title, uri: uri});
        } else {
          mapTargets.push({ code: element.mapTarget, display: 'Not found in ICD11'});
        }
      });
      if (mapTargets.length > 0) {
        this.selectedReasonCIE11.push(mapTargets);
      }
    }
    
    this.loadingIcd11 = false;
    
    // Force Angular change detection to update the UI
    this.cdr.detectChanges();
  }

  matchIcd10(event: any) {
    this.loadingIcd10 = true;
    this.icd10rules = [];
    this.selectedReasonCIE = [];
    let response = this.terminologyService.runEclLegacy(`^[*] 447562003 |ICD-10 complex map reference set| {{ M referencedComponentId = ${event.code} }}`);
    response.subscribe(result => {
      result.items.sort((a: any, b: any) => {
        if (a.mapGroup < b.mapGroup) {
          return -1;
        }
        if (a.mapGroup > b.mapGroup) {
          return 1;
        }
        if (a.mapPriority < b.mapPriority) {
          return -1;
        }
        if (a.mapPriority > b.mapPriority) {
          return 1;
        }
        if (a.mapTarget < b.mapTarget) {
          return -1;
        }
        if (a.mapTarget > b.mapTarget ) {
          return 1;
        }
        return 0;
      });
      this.icd10rules = result.items;
      let group = 0;
      result.items.forEach( (element: any) => {
        let passesMapRules = false;
        if (element.mapRule == 'TRUE' || element.mapRule == "OTHERWISE TRUE") {
          passesMapRules = true;
        } else {
          let localRule = element.mapRule;
          localRule = localRule.replaceAll('IFA 248153007 | Male (finding) |', 'this.gender.code == "248153007"');
          localRule = localRule.replaceAll('IFA 248152002 | Female (finding) |', 'this.gender.code == "248152002"');
          localRule = localRule.replaceAll('IFA 445518008 | Age at onset of clinical finding (observable entity) |', 'this.age');
          localRule = localRule.replaceAll('AND', '&&');
          localRule = localRule.replaceAll('OR', '||');
          localRule = localRule.replaceAll(' years', '');
          console.log(localRule);
          if (eval(localRule)) {
            passesMapRules = true;
          }
        }
        if ( passesMapRules && element.mapGroup !== group) {
            element.result = true;
            group = element.mapGroup;
            let searchCode = element.mapTarget;
            let dotIndex = element.mapTarget.indexOf('.');
            if (dotIndex > 0) {
              searchCode = element.mapTarget.substring(0, dotIndex + 2) + element.mapTarget.substring(dotIndex + 3);
            }
            if (element.mapTarget) {
              let cieCode = { code: element.mapTarget, display: '[Label not found]'};
              if (this.useICD10CodeSystem) {
                this.terminologyService.lookupOtherCodeSystems('http://hl7.org/fhir/sid/icd-10', searchCode).subscribe(lookupResponse => {
                  if (lookupResponse?.parameter?.length > 0) {
                    cieCode.display = lookupResponse.parameter.find((param: any) => param.name == 'display').valueString;
                  }
                  this.selectedReasonCIE.push(cieCode);
                });
              } else {
                cieCode.display = this.getDisplayFromICD10Data(searchCode);
                this.selectedReasonCIE.push(cieCode);
              }
              
            } else {
              let cieCode = { code: element.mapTarget, display: element.mapAdvice};
              this.selectedReasonCIE.push(cieCode);
            }
          
        }
      });
      this.loadingIcd10 = false;
    });
  }
  
  getDisplayFromICD10Data(code: string) {
    let display = this.icd10Data.find((element: any) => element.ICD10_Code == code);
    if (display) {
      return display.Short_Description;
    }
    return '';
  }

  /**
   * Detects the format of the ICD11 map data based on the columns present
   * @param data Parsed data from Papa Parse
   * @returns 'preview' for the simple format, 'extended' for the full refset format
   */
  private detectIcd11MapFormat(data: any[]): 'preview' | 'extended' {
    if (data.length === 0) {
      return 'preview'; // Default fallback
    }
    
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    
    // Check for extended format columns
    if (columns.includes('id') && columns.includes('effectiveTime') && columns.includes('active') && 
        columns.includes('moduleId') && columns.includes('refsetId') && columns.includes('mapRule')) {
      return 'extended';
    }
    
    // Otherwise assume preview format
    return 'preview';
  }

  /**
   * Normalizes ICD11 map data to a consistent format regardless of source
   * @param data Raw parsed data
   * @param format The detected format
   * @returns Normalized data array
   */
  private normalizeIcd11MapData(data: any[], format: 'preview' | 'extended'): any[] {
    if (format === 'preview') {
      // Preview format is already in the expected structure, just ensure mapRule exists
      return data.map(item => ({
        ...item,
        mapRule: item.mapRule || 'TRUE', // Default to TRUE if no mapRule
        active: '1' // Assume active if not specified
      }));
    } else {
      // Extended format - filter active records and ensure all fields are present
      return data
        .filter(item => item.active === '1') // Only include active records
        .map(item => ({
          referencedComponentId: item.referencedComponentId,
          mapGroup: item.mapGroup,
          mapPriority: item.mapPriority,
          mapAdvice: item.mapAdvice,
          mapTarget: item.mapTarget,
          mapRule: item.mapRule || 'TRUE',
          active: item.active
        }));
    }
  }

  /**
   * Loads an ICD11 map file and processes it
   * @param filePath Path to the file to load
   * @param dialogRef Reference to the loading dialog
   * @returns Promise that resolves when file is loaded and processed
   */
  private loadIcd11MapFile(filePath: string, dialogRef: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http
        .get(filePath, { responseType: 'text', reportProgress: true, observe: 'events' })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.DownloadProgress) {
              // Calculate the progress percentage if possible
              if (event.total !== undefined) {
                const percentDone = Math.round((100 * event.loaded) / event.total);
                dialogRef.componentInstance.progress = percentDone;
              }
            } else if (event.type === HttpEventType.Response) {
              // Parse the data and process it
              if (typeof event.body === 'string') {
                const parsedData = Papa.parse(event.body, { header: true }).data;
                this.icd11MapDataFormat = this.detectIcd11MapFormat(parsedData);
                this.icd11MapData = this.normalizeIcd11MapData(parsedData, this.icd11MapDataFormat);
                
                // Clear cached results when new data is loaded
                this.clearCachedResults();
                
                console.log(`✅ ICD11 map data loaded: ${this.icd11MapDataFormat} format (${this.icd11MapDataVersion}) - ${this.icd11MapData.length} records`);
                
                // If there's a current search term, refresh the results with new data
                if (this.selectedReasonSct && this.selectedReasonSct.code) {
                  setTimeout(() => {
                    this.matchIcd11(this.selectedReasonSct);
                  }, 100);
                }
                
                resolve();
              } else {
                reject(new Error('Invalid response body type'));
              }
            }
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  fetchTsvFile(icd11Param: string | null = null) {
    const dialogRef = this.dialog.open(LoadingDialogComponent, { disableClose: true });
    
    // Determine which file to load based on icd11 parameter
    let primaryFile: string;
    let fallbackFile: string;
    
    if (icd11Param === '2024') {
      // Load extended format when icd11=2024
      primaryFile = 'assets/der2_iisssccRefset_Icd11MapExtendedMapSnapshot_INT_20241001.txt';
      fallbackFile = 'assets/icd11-map-preview.tsv';
      this.icd11MapDataVersion = '2024';
    } else {
      // Default to simple format
      primaryFile = 'assets/icd11-map-preview.tsv';
      fallbackFile = 'assets/der2_iisssccRefset_Icd11MapExtendedMapSnapshot_INT_20241001.txt';
      this.icd11MapDataVersion = 'default';
    }
    this.loadIcd11MapFile(primaryFile, dialogRef)
      .catch(() => {
        // If primary file fails, try the fallback
        return this.loadIcd11MapFile(fallbackFile, dialogRef);
      })
      .then(() => {
        // Continue with loading other files after ICD11 map is loaded
        this.http
          .get('assets/LinearizationMiniOutput-MMS-en.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
          .subscribe((event) => {
            if (event.type === HttpEventType.DownloadProgress) {
              // Calculate the progress percentage if possible
              if (event.total !== undefined) {
                const percentDone = Math.round((100 * event.loaded) / event.total);
                dialogRef.componentInstance.progress = percentDone;
              }
            } else if (event.type === HttpEventType.Response) {
              // Parse the TSV data into a JavaScript object using Papa Parse
              if (typeof event.body === 'string') {
                const parsedData = Papa.parse(event.body, { header: true }).data;
                this.icd11Data = parsedData;
              }
              this.http
                .get('assets/icd102019-covid-expandedsyst_codes.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
                .subscribe((event) => {
                  if (event.type === HttpEventType.DownloadProgress) {
                    // Calculate the progress percentage if possible
                    if (event.total !== undefined) {
                      const percentDone = Math.round((100 * event.loaded) / event.total);
                      dialogRef.componentInstance.progress = percentDone;
                    }
                  } else if (event.type === HttpEventType.Response) {
                    // Close the dialog when the file is loaded
                    dialogRef.close();
                    // Parse the TSV data into a JavaScript object using Papa Parse
                    if (typeof event.body === 'string') {
                      const parsedData = Papa.parse(event.body, { header: true }).data;
                      this.icd10Data = parsedData;
                    }
                  }
                });
            }
          });
      })
      .catch(() => {
        dialogRef.close();
      });
  }

  fetchICD10CsvFile() {
    const dialogRef = this.dialog.open(LoadingDialogComponent, { disableClose: true });
    
    // Load ICD10 data first, then continue with other files
    this.http
      .get('assets/icd102019-covid-expandedsyst_codes.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
      .subscribe((event) => {
        if (event.type === HttpEventType.DownloadProgress) {
          // Calculate the progress percentage if possible
          if (event.total !== undefined) {
            const percentDone = Math.round((100 * event.loaded) / event.total);
            dialogRef.componentInstance.progress = percentDone;
          }
        } else if (event.type === HttpEventType.Response) {
          // Parse the CSV data into a JavaScript object using Papa Parse
          if (typeof event.body === 'string') {
            const parsedData = Papa.parse(event.body, { header: true }).data;
            // Note: This method seems to be for ICD10 data, not ICD11 map data
            // If this is intended for ICD11 map data, it should use the new dual-format approach
            this.icd10Data = parsedData; // Changed from icd11MapData to icd10Data
          }
          
          this.http
            .get('assets/LinearizationMiniOutput-MMS-en.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
            .subscribe((event) => {
              if (event.type === HttpEventType.DownloadProgress) {
                // Calculate the progress percentage if possible
                if (event.total !== undefined) {
                  const percentDone = Math.round((100 * event.loaded) / event.total);
                  dialogRef.componentInstance.progress = percentDone;
                }
              } else if (event.type === HttpEventType.Response) {
                // Close the dialog when the file is loaded
                dialogRef.close();
                // Parse the TSV data into a JavaScript object using Papa Parse
                if (typeof event.body === 'string') {
                  const parsedData = Papa.parse(event.body, { header: true }).data;
                  this.icd11Data = parsedData;
                }
              }
            });
        }
      });
  }

  removeSecondDigitAfterDot(code: string) {
    let dotIndex = code.indexOf('.');
    if (dotIndex > 0) {
      code = code.substring(0, dotIndex + 2) + code.substring(dotIndex + 3);
    }
    return code;
  }

  /**
   * Clears all cached mapping results
   * Called when switching between file formats to ensure fresh results
   */
  private clearCachedResults() {
    // Clear ICD11 results
    this.selectedReasonCIE11 = [];
    this.icd11rules = [];
    
    // Clear ICD10 results 
    this.selectedReasonCIE = [];
    this.icd10rules = [];
    
    // Reset loading states
    this.loadingIcd11 = false;
    this.loadingIcd10 = false;
  }

  /**
   * Manually reload ICD11 map data with a specific format
   * Useful for testing or switching between formats
   * @param format 'extended' or 'preview'
   */
  reloadIcd11MapData(format: 'extended' | 'preview') {
    const dialogRef = this.dialog.open(LoadingDialogComponent, { disableClose: true });
    
    const fileName = format === 'extended' 
      ? 'assets/der2_iisssccRefset_Icd11MapExtendedMapSnapshot_INT_20241001.txt'
      : 'assets/icd11-map-preview.tsv';
    
    // Update version tracking for manual reloads
    this.icd11MapDataVersion = format === 'extended' ? '2024' : 'default';
    
    this.loadIcd11MapFile(fileName, dialogRef)
      .then(() => {
        dialogRef.close();
      })
      .catch(() => {
        dialogRef.close();
      });
  }

  /**
   * Reload data based on current URL parameters
   * Useful for refreshing data after URL changes
   */
  reloadBasedOnUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const icd11Param = urlParams.get('icd11');
    this.fetchTsvFile(icd11Param);
  }

  /**
   * Force refresh current search results with current data
   * Useful for testing or when you want to see updated results
   */
  refreshCurrentResults() {
    if (this.selectedReasonSct && this.selectedReasonSct.code) {
      this.clearCachedResults();
      this.updateReason(this.selectedReasonSct);
    }
  }

  /**
   * Test search for a specific code to verify data differences
   * @param code SNOMED CT code to search for
   */
  testSearchForCode(code: string) {
    console.log(`Testing search for code: ${code} - Dataset: ${this.icd11MapDataVersion} format (${this.icd11MapDataFormat})`);
    
    const matches = this.icd11MapData.filter((element: any) => element.referencedComponentId == code);
    console.log(`Found ${matches.length} matches:`, matches.map(m => `${m.mapGroup}-${m.mapPriority}: ${m.mapTarget}`));
  }

  /**
   * Test the known different code 421671002 (Pneumonia with AIDS)
   * This code has different mappings in each format:
   * - Simple format: CA40.Y, QC6Y  
   * - Extended format: 1C62.3Y, XN487, 1C62.3, XN487
   */
  testPneumoniaWithAids() {
    console.log('Testing Pneumonia with AIDS (421671002) - known to have different mappings');
    this.testSearchForCode('421671002');
    
    // Also trigger a full mapping search
    const testConcept = { code: '421671002', display: 'Pneumonia with AIDS (acquired immunodeficiency syndrome)' };
    this.matchIcd11(testConcept);
  }

  /**
   * Test method to verify parameter switching works correctly
   * Can be called from browser console: window['icdMapComponent'].testParameterSwitching()
   */
  testParameterSwitching() {
    console.log('Testing parameter switching...');
    
    // Test loading simple format
    this.fetchTsvFile(null);
    
    // Wait a bit then test extended format
    setTimeout(() => {
      this.fetchTsvFile('2024');
    }, 3000);
  }

  /**
   * Complete test that switches formats and compares results for code 421671002
   * This will clearly show if the cache clearing and data switching works
   */
  testFormatSwitchingWithPneumonia() {
    console.log('Testing format switching with Pneumonia with AIDS (421671002)');
    console.log('Expected: Simple format: CA40.Y, QC6Y | Extended format: 1C62.3Y, XN487, 1C62.3, XN487');
    
    // Load simple format and test
    this.reloadIcd11MapData('preview');
    
    setTimeout(() => {
      this.testPneumoniaWithAids();
      
      // Switch to extended format
      setTimeout(() => {
        this.reloadIcd11MapData('extended');
        
        setTimeout(() => {
          this.testPneumoniaWithAids();
        }, 2000);
      }, 3000);
    }, 2000);
  }

}
