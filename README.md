# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
|Hamza Barrada | 327986 |
|Amer Lakrami | 344911 |
|Ziad Chentouf | 344912 |
|Salma EL YADOUNI | 340859 |

## Getting Started

### 1. Clone the repository
```bash
git clone git@github.com:com-480-data-visualization/com-480-project-XLB.git
cd com-480-project-XLB
```

### 2. Create and activate the conda environment
```bash
conda create -n movies-viz python=3.11 -y
conda activate movies-viz
pip install kaggle pandas matplotlib seaborn jupyter
```

### 3. Download the dataset
### Option 1 — Kaggle CLI (recommended)

```bash
kaggle datasets download -d rounakbanik/the-movies-dataset -p data/raw/ --unzip
```

Verify the download:
```bash
ls -lh data/raw/
```
### Alternative: Manual Download
1. Go to https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset
2. Click **Download** (requires free Kaggle account)
3. Unzip the downloaded file
4. Move all CSV files into `data/raw/`:
```bash
mv ~/Downloads/archive/* data/raw/
```

See `data/README.md` for details on each file.

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (20th March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

> Find a dataset (or multiple) that you will explore. Assess the quality of the data it contains and how much preprocessing / data-cleaning it will require before tackling visualization. We recommend using a standard dataset as this course is not about scraping nor data processing.
>
> Hint: some good pointers for finding quality publicly available datasets ([Google dataset search](https://datasetsearch.research.google.com/), [Kaggle](https://www.kaggle.com/datasets), [OpenSwissData](https://opendata.swiss/en/), [SNAP](https://snap.stanford.edu/data/) and [FiveThirtyEight](https://data.fivethirtyeight.com/)).

### Problematic

> Frame the general topic of your visualization and the main axis that you want to develop.
> - What am I trying to show with my visualization?
> - Think of an overview for the project, your motivation, and the target audience.

### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.

## Milestone 2 (17th April, 5pm)

**10% of the final grade**


## Milestone 3 (29th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone


---

### 4. Launch Jupyter
```bash
jupyter notebook
# Open eda/eda_movies.ipynb
```
